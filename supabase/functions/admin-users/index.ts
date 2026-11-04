// Edge Function: gestión de usuarios por el admin.
//
// Única pieza que usa la service_role key. Toda petición se autentica con el JWT del llamante y
// se verifica que sea un admin activo antes de hacer nada.
//
// Acciones (POST JSON):
//   { action: 'create',         users: [{ email, full_name, department? }] }  → contraseñas temporales
//   { action: 'reset_password', user_id }                                     → nueva contraseña temporal
//   { action: 'set_role',       user_id, role: 'participant' | 'admin' }
//   { action: 'set_active',     user_id, active: boolean }
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { z } from 'npm:zod@4.6.7';

// 150 usuarios ≈ 30 KB: cualquier cuerpo mucho mayor se rechaza antes de parsearlo.
const MAX_BODY_BYTES = 64 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const userInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120).optional().nullable(),
});

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), users: z.array(userInput).min(1).max(150) }),
  z.object({ action: z.literal('reset_password'), user_id: z.string().uuid() }),
  z.object({
    action: z.literal('set_role'),
    user_id: z.string().uuid(),
    role: z.enum(['participant', 'admin']),
  }),
  z.object({ action: z.literal('set_active'), user_id: z.string().uuid(), active: z.boolean() }),
]);

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Sin caracteres ambiguos (0/O, 1/l/I). Siempre incluye letras y dígitos (política de Auth).
const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
function generateTempPassword(length = 12): string {
  const alphabet = LETTERS + DIGITS;
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  chars[0] = LETTERS[bytes[0] % LETTERS.length];
  chars[length - 1] = DIGITS[bytes[length - 1] % DIGITS.length];
  return chars.join('');
}

async function requireAdmin(req: Request, admin: SupabaseClient): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'No autenticado');

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sesión inválida');

  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    throw new HttpError(403, 'Solo un administrador puede hacer esto');
  }
  return data.user.id;
}

async function audit(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await admin
    .from('audit_log')
    .insert({ actor_id: actorId, action, target_id: targetId, details });
  if (error) console.error('audit_log insert failed', error);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const actorId = await requireAdmin(req, admin);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return json({ error: 'Petición demasiado grande' }, 413);
    }
    let payload: unknown = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      /* se valida abajo */
    }
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return json({ error: 'Datos inválidos', issues: parsed.error.issues }, 400);
    }
    const body = parsed.data;

    switch (body.action) {
      case 'create': {
        const results = [];
        for (const user of body.users) {
          const password = generateTempPassword();
          const { data, error } = await admin.auth.admin.createUser({
            email: user.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: user.full_name, department: user.department ?? null },
          });
          if (error || !data.user) {
            const duplicated = error?.message?.toLowerCase().includes('already');
            results.push({
              email: user.email,
              ok: false,
              error: duplicated ? 'Ya existe un usuario con este email' : 'No se pudo crear',
            });
            if (!duplicated) console.error('createUser failed', user.email, error);
            continue;
          }
          await audit(admin, actorId, 'user.create', data.user.id, { email: user.email });
          results.push({
            email: user.email,
            full_name: user.full_name,
            ok: true,
            temp_password: password,
          });
        }
        return json({ results });
      }

      case 'reset_password': {
        const password = generateTempPassword();
        const { error } = await admin.auth.admin.updateUserById(body.user_id, { password });
        if (error) throw new HttpError(400, 'No se pudo restablecer la contraseña');
        await admin.from('profiles').update({ must_change_password: true }).eq('id', body.user_id);
        await audit(admin, actorId, 'user.reset_password', body.user_id);
        return json({ temp_password: password });
      }

      case 'set_role': {
        if (body.user_id === actorId && body.role !== 'admin') {
          throw new HttpError(400, 'No puedes quitarte el rol de administrador a ti mismo');
        }
        const { error } = await admin
          .from('profiles')
          .update({ role: body.role })
          .eq('id', body.user_id);
        if (error) throw new HttpError(400, 'No se pudo cambiar el rol');
        await audit(admin, actorId, 'user.set_role', body.user_id, { role: body.role });
        return json({ ok: true });
      }

      case 'set_active': {
        if (body.user_id === actorId && !body.active) {
          throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
        }
        const { error: authError } = await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: body.active ? 'none' : '876000h',
        });
        if (authError) throw new HttpError(400, 'No se pudo actualizar la cuenta');
        const { error } = await admin
          .from('profiles')
          .update({ is_active: body.active })
          .eq('id', body.user_id);
        if (error) throw new HttpError(400, 'No se pudo actualizar la cuenta');
        await audit(admin, actorId, 'user.set_active', body.user_id, { active: body.active });
        return json({ ok: true });
      }
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Error interno' }, 500);
  }
});

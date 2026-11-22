// Edge Function: envía notificaciones push (Web Push con VAPID).
//
// La llama SOLO la base de datos (triggers en messages y notifications vía pg_net), con el
// secreto compartido en la cabecera x-push-secret. No recibe JWT de usuarios (verify_jwt = false).
//
// Cuerpo: { jobs: [{ user_id, kind, title, body, url, tag, thread_id? }] }
// Quién recibe y con qué título (nombre o alias) ya viene decidido por la base de datos: esta
// función no sabe quién escribió cada mensaje.
//
// Secrets necesarios: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
import { z } from 'npm:zod@4.6.7';

// Un aviso a ~150 personas ≈ 60 KB.
const MAX_BODY_BYTES = 512 * 1024;
// Envíos simultáneos como máximo.
const CONCURRENCY = 20;
// Si el dispositivo está apagado, el servicio push guarda el mensaje hasta 1 día.
const TTL_SECONDS = 24 * 60 * 60;

// Debe coincidir con public.is_valid_push_subscription: nunca se hacen peticiones a otros hosts.
const PUSH_SERVICE =
  /^https:\/\/([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)\//;

const jobSchema = z.object({
  user_id: z.string().uuid(),
  kind: z.enum(['chat', 'notification']),
  title: z.string().min(1).max(200),
  body: z.string().max(400),
  // Solo rutas internas de la app ('/x'), nunca '//dominio'.
  url: z
    .string()
    .max(300)
    .regex(/^\/(?![/\\])/),
  tag: z.string().max(100),
  thread_id: z.string().uuid().optional().nullable(),
});

const requestSchema = z.object({ jobs: z.array(jobSchema).min(1).max(2000) });

type Job = z.infer<typeof jobSchema>;

interface StoredSubscription {
  id: string;
  user_id: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Comparación en tiempo constante (no filtra el secreto por la duración de la respuesta). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Ejecuta las tareas de `items` con como mucho `limit` en paralelo. */
async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  });
  await Promise.all(workers);
}

const env = {
  secret: Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '',
  vapidPublic: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  vapidPrivate: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  vapidSubject: Deno.env.get('VAPID_SUBJECT') ?? '',
};

const configured = !!(env.secret && env.vapidPublic && env.vapidPrivate && env.vapidSubject);
if (configured) webpush.setVapidDetails(env.vapidSubject, env.vapidPublic, env.vapidPrivate);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!configured) {
    console.error('send-push: faltan secrets (VAPID_* o PUSH_WEBHOOK_SECRET)');
    return json({ error: 'Push no configurado' }, 500);
  }
  if (!safeEqual(req.headers.get('x-push-secret') ?? '', env.secret)) {
    return json({ error: 'No autorizado' }, 401);
  }

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
  if (!parsed.success) return json({ error: 'Datos inválidos' }, 400);
  const jobs = parsed.data.jobs;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const userIds = [...new Set(jobs.map((j) => j.user_id))];
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, subscription')
    .in('user_id', userIds);
  if (error) {
    console.error('send-push: no se pudieron leer las suscripciones', error.message);
    return json({ error: 'Error interno' }, 500);
  }

  const byUser = new Map<string, StoredSubscription[]>();
  for (const sub of (subs ?? []) as StoredSubscription[]) {
    if (!PUSH_SERVICE.test(sub.subscription.endpoint)) continue;
    byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub]);
  }

  const deliveries: { job: Job; sub: StoredSubscription }[] = jobs.flatMap((job) =>
    (byUser.get(job.user_id) ?? []).map((sub) => ({ job, sub })),
  );

  let sent = 0;
  let failed = 0;
  const expired = new Set<string>();

  await runPool(deliveries, CONCURRENCY, async ({ job, sub }) => {
    const message = JSON.stringify({
      kind: job.kind,
      title: job.title,
      body: job.body,
      url: job.url,
      tag: job.tag,
      threadId: job.thread_id ?? null,
    });
    try {
      await webpush.sendNotification(sub.subscription, message, {
        TTL: TTL_SECONDS,
        urgency: job.kind === 'chat' ? 'high' : 'normal',
      });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // El navegador anuló la suscripción (desinstalada, permiso revocado, caducada).
        expired.add(sub.id);
      } else {
        failed++;
        console.error('send-push: envío fallido', status ?? (err as Error).message);
      }
    }
  });

  if (expired.size > 0) {
    const { error: deleteError } = await admin
      .from('push_subscriptions')
      .delete()
      .in('id', [...expired]);
    if (deleteError) console.error('send-push: no se pudieron borrar las caducadas', deleteError);
  }

  // Solo conteos: nunca se registra el contenido ni a quién va.
  console.log(
    `send-push: jobs=${jobs.length} envios=${deliveries.length} ok=${sent} caducadas=${expired.size} fallos=${failed}`,
  );
  return json({ sent, expired: expired.size, failed });
});

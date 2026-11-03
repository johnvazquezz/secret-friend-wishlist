// Prueba E2E de la Fase 2 (cuentas, permisos, fotos) contra Supabase local.
// Ejecutar con: npm run test:e2e  (ver e2e/README.md)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const URL = 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PW = 'Amigo2026local';

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
const client = () => createClient(URL, ANON, { auth: { persistSession: false } });
async function login(email, password) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// anon
{
  const anon = client();
  const { data, error } = await anon.from('team_members').select('access_code');
  check(!!error || (data ?? []).length === 0, 'anon NO lee access_code por REST');
  const signup = await anon.auth.signUp({ email: 'intruso@x.com', password: 'Intruso12345' });
  check(!!signup.error, `registro público deshabilitado (${signup.error?.code})`);
}

// participante
const ana = await login('ana@local.test', PW);
{
  const r = await ana.functions.invoke('admin-users', {
    body: { action: 'create', users: [{ email: 'x@x.com', full_name: 'X' }] },
  });
  check(r.error?.context?.status === 403, 'participante recibe 403 en admin-users');
  const { error } = await ana.from('team_members').select('access_code');
  check(!!error, 'participante NO lee access_code');
  const own = await ana.storage
    .from('avatars')
    .upload(
      '00000000-0000-4000-8000-000000000002/avatar.webp',
      new Blob(['x'], { type: 'image/webp' }),
      { upsert: true },
    );
  check(!own.error, `participante sube su foto ${own.error?.message ?? ''}`);
  const other = await ana.storage
    .from('avatars')
    .upload(
      '00000000-0000-4000-8000-000000000003/avatar.webp',
      new Blob(['x'], { type: 'image/webp' }),
      { upsert: true },
    );
  check(!!other.error, 'participante NO sube la foto de otro');
  const bad = await ana.storage
    .from('avatars')
    .upload(
      '00000000-0000-4000-8000-000000000002/x.pdf',
      new Blob(['x'], { type: 'application/pdf' }),
      { upsert: true },
    );
  check(!!bad.error, 'bucket rechaza tipos no imagen');
  const signed = await ana.storage
    .from('avatars')
    .createSignedUrls(['00000000-0000-4000-8000-000000000002/avatar.webp'], 60);
  check(!signed.error && !!signed.data?.[0]?.signedUrl, 'URL firmada de avatar');
}

// admin
const admin = await login('admin@local.test', PW);
const email = `nuevo${Date.now()}@local.test`;
let tempPassword;
let newId;
{
  const r = await admin.functions.invoke('admin-users', {
    body: {
      action: 'create',
      users: [
        { email, full_name: 'Nuevo Usuario', department: 'QA' },
        { email: 'ana@local.test', full_name: 'Duplicada' },
      ],
    },
  });
  check(!r.error, `admin crea usuarios ${r.error?.message ?? ''}`);
  const [ok, dup] = r.data?.results ?? [];
  check(
    ok?.ok && /^[A-Za-z0-9]{12}$/.test(ok.temp_password),
    'devuelve contraseña temporal de 12 caracteres',
  );
  check(dup && !dup.ok && /Ya existe/.test(dup.error), 'detecta email duplicado');
  tempPassword = ok?.temp_password;
  const { data: prof } = await admin.from('profiles').select('*').eq('email', email).single();
  newId = prof?.id;
  check(
    prof?.full_name === 'Nuevo Usuario' && prof.department === 'QA' && prof.must_change_password,
    'perfil creado por trigger con contraseña temporal',
  );
  const self = await admin.functions.invoke('admin-users', {
    body: {
      action: 'set_role',
      user_id: '00000000-0000-4000-8000-000000000001',
      role: 'participant',
    },
  });
  check(self.error?.context?.status === 400, 'admin no puede quitarse su propio rol');
  const { data: logs } = await admin.from('audit_log').select('action').eq('target_id', newId);
  check(
    logs?.some((l) => l.action === 'user.create'),
    'queda registro en audit_log',
  );
}

// nuevo usuario: entra con la temporal, la cambia
{
  const nuevo = await login(email, tempPassword);
  const weak = await nuevo.auth.updateUser({ password: 'corta' });
  check(!!weak.error, `política rechaza contraseña débil (${weak.error?.code})`);
  const upd = await nuevo.auth.updateUser({ password: 'NuevaClave2026' });
  check(!upd.error, 'cambia su contraseña');
  const rpc = await nuevo.rpc('complete_password_change');
  check(!rpc.error, 'complete_password_change');
  const { data: me } = await nuevo
    .from('profiles')
    .select('must_change_password')
    .eq('id', newId)
    .single();
  check(me?.must_change_password === false, 'marca de contraseña temporal limpiada');
  await login(email, 'NuevaClave2026');
  check(true, 'entra con la nueva contraseña');
}

// reset + desactivar
{
  const r = await admin.functions.invoke('admin-users', {
    body: { action: 'reset_password', user_id: newId },
  });
  check(!r.error && r.data?.temp_password, 'admin restablece contraseña');
  const { data: p } = await admin
    .from('profiles')
    .select('must_change_password')
    .eq('id', newId)
    .single();
  check(p?.must_change_password === true, 'reset vuelve a exigir cambio de contraseña');
  const d = await admin.functions.invoke('admin-users', {
    body: { action: 'set_active', user_id: newId, active: false },
  });
  check(!d.error, 'admin desactiva la cuenta');
  const blocked = await client().auth.signInWithPassword({ email, password: r.data.temp_password });
  check(!!blocked.error, `cuenta desactivada no puede entrar (${blocked.error?.code})`);
  const role = await admin.functions.invoke('admin-users', {
    body: { action: 'set_role', user_id: newId, role: 'admin' },
  });
  check(!role.error, 'admin cambia rol de otro usuario');
}

console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

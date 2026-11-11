// Prueba E2E del sorteo hecho fuera de la app (papelitos) contra Supabase local.
// Ejecutar con: npm run test:e2e  (ver e2e/README.md)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const URL = 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PW = 'Amigo2026local';
const USERS = ['ana', 'luis', 'maria', 'pedro', 'sofia', 'jorge'];

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
async function login(name) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `${name}@local.test`, password: PW });
  if (error) throw new Error(`login ${name}: ${error.message}`);
  return c;
}

const admin = await login('admin');
const p = Object.fromEntries(await Promise.all(USERS.map(async (u) => [u, await login(u)])));
const { data: profiles } = await admin.from('profiles').select('id, email');
const id = Object.fromEntries(profiles.map((x) => [x.email.split('@')[0], x.id]));

// 1. El admin crea el evento, añade a todos menos a sí mismo y marca "sorteo ya hecho"
const { data: event } = await admin
  .from('events')
  .insert({ name: 'Papelitos E2E', currency: 'USD' })
  .select('*')
  .single();
await admin
  .from('event_participants')
  .insert(USERS.map((u) => ({ event_id: event.id, user_id: id[u] })));
await admin.rpc('admin_set_participation', {
  p_event_id: event.id,
  p_user_id: id.jorge,
  p_status: 'declined',
});

const started = await p.ana.rpc('start_manual_event', { p_event_id: event.id });
check(started.error?.message === 'not_admin', 'un participante no puede iniciar el modo papelitos');

const { data: n, error: startErr } = await admin.rpc('start_manual_event', {
  p_event_id: event.id,
});
check(!startErr && n === 5, 'el admin marca el sorteo como hecho (5 participantes, Jorge no)');

const { data: ev } = await p.ana
  .from('events')
  .select('status, draw_mode')
  .eq('id', event.id)
  .single();
check(
  ev.status === 'published' && ev.draw_mode === 'manual',
  'el evento queda publicado en modo papelitos',
);

const { data: notes } = await p.ana.from('notifications').select('kind');
check(
  notes.some((x) => x.kind === 'manual_claim'),
  'Ana recibe el aviso de registrar a su amigo secreto',
);

// 2. Registros
const claim = (who, to) =>
  p[who].rpc('claim_recipient', { p_event_id: event.id, p_receiver_id: id[to] });
const mine = async (who) =>
  (await p[who].rpc('get_my_assignment', { p_event_id: event.id })).data?.[0] ?? null;

check(!(await claim('ana', 'luis')).error, 'Ana registra a Luis');
check((await mine('ana'))?.full_name === 'Luis Gómez', 'Ana ve a Luis como su amigo secreto');

const taken = await claim('maria', 'luis');
check(
  taken.error?.message === 'recipient_taken',
  'María no puede registrar a Luis (ya registrado)',
);
check(
  !JSON.stringify(taken.error).includes(id.ana) && !/Ana/.test(JSON.stringify(taken.error)),
  'el error no revela quién registró a Luis',
);
check(
  (await claim('jorge', 'ana')).error?.message === 'not_participant',
  'Jorge (no participa) no registra a nadie',
);
check(
  (await claim('ana', 'ana')).error?.message === 'cannot_claim_self',
  'nadie se registra a sí mismo',
);

const direct = await p.ana.from('assignments').select('*');
check(!!direct.error, 'nadie lee la tabla de asignaciones');
const adminDirect = await admin.from('assignments').select('*');
check(!!adminDirect.error, 'el admin tampoco');

// 3. Chat con el registro manual
const convs = async (who) =>
  (await p[who].rpc('get_my_conversations', { p_event_id: event.id })).data ?? [];
const anaThread = (await convs('ana')).find((t) => t.is_my_recipient);
check(anaThread?.partner_name === 'Luis Gómez', 'Ana tiene su chat con Luis');

const sent = await p.ana.rpc('send_thread_message', {
  p_thread_id: anaThread.thread_id,
  p_body: 'Hola Luis',
});
check(!sent.error, 'Ana escribe a Luis');
const asReceiver = (await convs('luis')).find((t) => t.thread_id === anaThread.thread_id);
check(
  !!asReceiver && asReceiver.partner_name === null && !!asReceiver.partner_alias,
  'Luis ve el chat con un alias anónimo',
);
check(
  (await claim('ana', 'maria')).error?.message === 'claim_locked',
  'con mensajes Ana ya no puede cambiar',
);

// 4. Progreso para el admin: solo conteos
const { data: summary } = await admin.rpc('draw_summary', { p_event_id: event.id });
check(summary[0].assigned === 1 && summary[0].confirmed === 5, 'el admin ve 1 de 5 registrados');

// 5. El admin libera a Luis
const { error: relErr } = await admin.rpc('admin_release_recipient', {
  p_event_id: event.id,
  p_receiver_id: id.luis,
});
check(!relErr, 'el admin libera a Luis');
check((await mine('ana')) === null, 'Ana ya no tiene destinatario');
const { data: anaNotes } = await p.ana.from('notifications').select('kind');
check(
  anaNotes.some((x) => x.kind === 'claim_released'),
  'Ana recibe el aviso para registrarse de nuevo',
);

// 6. Todos registran: ciclo completo
for (const [giver, receiver] of [
  ['ana', 'luis'],
  ['luis', 'maria'],
  ['maria', 'pedro'],
  ['pedro', 'sofia'],
  ['sofia', 'ana'],
]) {
  const { error } = await claim(giver, receiver);
  check(!error, `${giver} registra a ${receiver}`);
}
const { data: done } = await admin.rpc('draw_summary', { p_event_id: event.id });
check(done[0].is_valid && done[0].assigned === 5, 'con todos registrados el sorteo es válido');

// 7. Alguien olvidado: el admin se añade tarde y participa directamente
const late = await admin
  .from('event_participants')
  .insert({ event_id: event.id, user_id: id.admin });
const { data: adminPart } = await admin
  .from('event_participants')
  .select('status')
  .eq('event_id', event.id)
  .eq('user_id', id.admin)
  .single();
check(!late.error && adminPart.status === 'confirmed', 'quien se añade tarde queda confirmado');

console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

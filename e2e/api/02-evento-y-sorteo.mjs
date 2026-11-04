// Prueba E2E de la Fase 3 (evento + sorteo) contra Supabase local.
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
const people = Object.fromEntries(await Promise.all(USERS.map(async (u) => [u, await login(u)])));

// 1. Admin crea el evento (borrador)
const { data: event, error: createErr } = await admin
  .from('events')
  .insert({
    name: 'Navidad E2E',
    budget_amount: 20,
    currency: 'USD',
    exchange_at: '2026-12-19T18:00:00Z',
  })
  .select('*')
  .single();
check(!createErr && event.status === 'draft', 'admin crea evento en borrador');

const { data: drafts } = await people.ana.from('events').select('id');
check(drafts.length === 0, 'participante no ve el borrador');

// 2. Admin agrega a todos (incluido él) y abre la inscripción
const { data: profiles } = await admin.from('profiles').select('id, email');
const idOf = Object.fromEntries(profiles.map((p) => [p.email.split('@')[0], p.id]));
const { error: addErr } = await admin
  .from('event_participants')
  .insert(profiles.map((p) => ({ event_id: event.id, user_id: p.id })));
check(!addErr, `admin agrega ${profiles.length} participantes`);
const open = await admin.rpc('open_event', { p_event_id: event.id });
check(!open.error, 'admin abre la inscripción');

// 3. Respuestas: todos confirman salvo Jorge; el admin confirma a Luis (nunca entra a la app)
for (const u of ['ana', 'maria', 'pedro', 'sofia']) {
  const r = await people[u].rpc('respond_participation', { p_event_id: event.id, p_accept: true });
  check(!r.error, `${u} confirma`);
}
const decline = await people.jorge.rpc('respond_participation', {
  p_event_id: event.id,
  p_accept: false,
});
check(!decline.error, 'jorge declina');
const bySelf = await admin.rpc('respond_participation', { p_event_id: event.id, p_accept: true });
check(!bySelf.error, 'admin confirma su propia participación');
const onBehalf = await admin.rpc('admin_set_participation', {
  p_event_id: event.id,
  p_user_id: idOf.luis,
  p_status: 'confirmed',
});
check(!onBehalf.error, 'admin confirma a Luis en su nombre');
const sneaky = await people.ana.rpc('admin_set_participation', {
  p_event_id: event.id,
  p_user_id: idOf.jorge,
  p_status: 'confirmed',
});
check(!!sneaky.error, 'un participante no puede cambiar la respuesta de otro');

// 4. Exclusión Ana ↮ María
const [a, b] = [idOf.ana, idOf.maria].sort();
const excl = await admin.from('exclusions').insert({ event_id: event.id, user_a: a, user_b: b });
check(!excl.error, 'admin crea exclusión Ana ↮ María');

// 5. Sorteo
const notAdmin = await people.ana.rpc('run_draw', { p_event_id: event.id });
check(!!notAdmin.error, 'participante no puede sortear');
const draw = await admin.rpc('run_draw', { p_event_id: event.id });
check(!draw.error && draw.data === 6, `sorteo hecho con ${draw.data} confirmados (Jorge fuera)`);
const again = await admin.rpc('run_draw', { p_event_id: event.id });
check(again.error?.message === 'invalid_event_status', 'no se puede sortear dos veces');

// 6. Privacidad
const adminRead = await admin.from('assignments').select('*');
check(!!adminRead.error, `el ADMIN no lee asignaciones por REST (${adminRead.error?.code})`);
const anaRead = await people.ana.from('assignments').select('*');
check(!!anaRead.error, 'participante no lee asignaciones por REST');
const early = await people.ana.rpc('get_my_assignment', { p_event_id: event.id });
check(!early.error && early.data.length === 0, 'antes de publicar nadie ve su destinatario');
const summary = await admin.rpc('draw_summary', { p_event_id: event.id });
check(
  summary.data?.[0]?.is_valid && summary.data[0].assigned === 6 && !('giver_id' in summary.data[0]),
  'el admin solo ve el resumen (6/6 válido)',
);
const lateAdd = await admin
  .from('event_participants')
  .insert({ event_id: event.id, user_id: idOf.jorge });
check(!!lateAdd.error, 'no se agregan participantes después del sorteo');

// 7. Publicar y comprobar que cada uno ve SOLO a su destinatario
const publish = await admin.rpc('publish_draw', { p_event_id: event.id });
check(!publish.error, 'admin publica');
const reset = await admin.rpc('reset_draw', { p_event_id: event.id });
check(
  reset.error?.message === 'invalid_event_status',
  'tras publicar no se puede repetir el sorteo',
);

const clients = { admin, ...people };
const receivers = {};
for (const [name, c] of Object.entries(clients)) {
  const r = await c.rpc('get_my_assignment', { p_event_id: event.id });
  receivers[name] = r.data?.[0];
}
const confirmedNames = ['admin', 'ana', 'luis', 'maria', 'pedro', 'sofia'];
check(
  confirmedNames.every((n) => receivers[n]),
  'cada confirmado ve a su destinatario',
);
check(!receivers.jorge, 'Jorge (no participa) no tiene destinatario');
check(
  confirmedNames.every((n) => receivers[n]?.receiver_id !== idOf[n]),
  'nadie se regala a sí mismo',
);
const received = confirmedNames.map((n) => receivers[n].receiver_id);
check(new Set(received).size === 6, 'cada persona recibe exactamente un regalo');
check(
  receivers.ana.receiver_id !== idOf.maria && receivers.maria.receiver_id !== idOf.ana,
  'la exclusión Ana ↮ María se respeta',
);
check(
  Object.keys(receivers.ana).sort().join() === 'avatar_path,department,full_name,receiver_id',
  'la respuesta solo contiene datos del destinatario (nunca quién te regala)',
);

console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

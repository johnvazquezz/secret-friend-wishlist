// Prueba E2E de la Fase 5 (chat + Realtime) contra Supabase local.
// Ejecutar con: npm run test:e2e  (ver e2e/README.md)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const URL = 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PW = 'Amigo2026local';
const NAMES = ['admin', 'ana', 'luis', 'maria', 'pedro', 'sofia', 'jorge'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const c = Object.fromEntries(await Promise.all(NAMES.map(async (n) => [n, await login(n)])));
const { data: profiles } = await c.admin.from('profiles').select('id, email, full_name');
const nameOf = Object.fromEntries(profiles.map((p) => [p.id, p.email.split('@')[0]]));

// Sorteo publicado con todos
const { data: event } = await c.admin
  .from('events')
  .insert({ name: 'E2E chat' })
  .select('id')
  .single();
await c.admin
  .from('event_participants')
  .insert(profiles.map((p) => ({ event_id: event.id, user_id: p.id })));
await c.admin.rpc('open_event', { p_event_id: event.id });
for (const p of profiles) {
  await c.admin.rpc('admin_set_participation', {
    p_event_id: event.id,
    p_user_id: p.id,
    p_status: 'confirmed',
  });
}
await c.admin.rpc('run_draw', { p_event_id: event.id });

const closed = await c.ana.rpc('send_message', {
  p_event_id: event.id,
  p_as: 'giver',
  p_body: 'hola',
});
check(closed.error?.message === 'chat_closed', 'chat cerrado antes de publicar');
await c.admin.rpc('publish_draw', { p_event_id: event.id });

// Elegimos un giver (no admin) cuyo destinatario tampoco sea el admin.
let giverName, anaAssign;
for (const n of NAMES.filter((x) => x !== 'admin')) {
  const { data } = await c[n].rpc('get_my_assignment', { p_event_id: event.id });
  if (nameOf[data[0].receiver_id] !== 'admin') {
    giverName = n;
    anaAssign = data;
    break;
  }
}
const giver = c[giverName];
const { data: anaThreads } = await giver.rpc('get_my_threads', { p_event_id: event.id });
const anaGiverThread = anaThreads.find((t) => t.my_role === 'giver');
const receiverName = nameOf[anaAssign[0].receiver_id];
const receiver = c[receiverName];
const outsider = c[NAMES.find((n) => n !== giverName && n !== receiverName && n !== 'admin')];
check(
  anaGiverThread && anaGiverThread.partner_name === anaAssign[0].full_name,
  `${giverName} ve su hilo con ${receiverName}`,
);

const { data: recThreads } = await receiver.rpc('get_my_threads', { p_event_id: event.id });
const recThread = recThreads.find((t) => t.my_role === 'receiver');
check(
  recThread.thread_id === anaGiverThread.thread_id,
  `${receiverName} tiene el mismo hilo (como receiver)`,
);
check(
  recThread.partner_name === null && recThread.partner_avatar_path === null,
  `${receiverName} no recibe nombre ni foto del giver`,
);

// Suscripciones Realtime: receptor, tercero y admin escuchan el MISMO hilo
const received = { receiver: [], outsider: [], admin: [] };
function listen(client, bucket) {
  return new Promise((resolve) => {
    client
      .channel(`t-${bucket}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${anaGiverThread.thread_id}`,
        },
        (p) => received[bucket].push(p.new),
      )
      .on('system', {}, (p) => p.extension === 'postgres_changes' && p.status === 'ok' && resolve())
      .subscribe();
  });
}
// Igual que la app: esperar el token antes de suscribirse
for (const client of [receiver, outsider, c.admin]) await client.realtime.setAuth();
await Promise.all([
  listen(receiver, 'receiver'),
  listen(outsider, 'outsider'),
  listen(c.admin, 'admin'),
]);
await sleep(1000);

const t0 = Date.now();
const sent = await giver.rpc('send_message', {
  p_event_id: event.id,
  p_as: 'giver',
  p_body: '¡Hola! ¿Qué te gusta?',
});
check(!sent.error, `${giverName} envía un mensaje anónimo`);
for (let i = 0; i < 50 && received.receiver.length === 0; i++) await sleep(100);
const latency = Date.now() - t0;
check(received.receiver.length === 1, `${receiverName} lo recibe en tiempo real (${latency} ms)`);
check(latency < 2000, 'en menos de 2 segundos');
const payload = received.receiver[0] ?? {};
check(
  Object.keys(payload).sort().join() === 'author_role,body,created_at,id,read_at,thread_id',
  `el payload solo trae: ${Object.keys(payload).sort().join(', ')}`,
);
check(
  !JSON.stringify(payload).includes(profiles.find((p) => nameOf[p.id] === giverName).id),
  'el payload no contiene el id del giver',
);
await sleep(1000);
check(received.outsider.length === 0, 'un tercero suscrito al hilo NO recibe nada');
check(received.admin.length === 0, 'el ADMIN suscrito al hilo NO recibe nada');

// Respuesta y no leídos
const reply = await receiver.rpc('send_message', {
  p_event_id: event.id,
  p_as: 'receiver',
  p_body: '¡Los libros!',
});
check(!reply.error, `${receiverName} responde`);
const { data: anaAfter } = await giver.rpc('get_my_threads', { p_event_id: event.id });
check(anaAfter.find((t) => t.my_role === 'giver').unread === 1, 'el giver tiene 1 sin leer');
await giver.rpc('mark_thread_read', { p_thread_id: anaGiverThread.thread_id });
const { data: anaRead } = await giver.rpc('get_my_threads', { p_event_id: event.id });
check(anaRead.find((t) => t.my_role === 'giver').unread === 0, 'tras abrirlo, 0 sin leer');

const { data: spy } = await outsider.from('messages').select('*');
check(
  (spy ?? []).every((m) => m.thread_id !== anaGiverThread.thread_id),
  'el tercero no lee el hilo por REST',
);
const { data: adminSpy } = await c.admin
  .from('messages')
  .select('*')
  .eq('thread_id', anaGiverThread.thread_id);
check((adminSpy ?? []).length === 0, 'el admin no lee el hilo por REST');

await Promise.all(Object.values(c).map((cl) => cl.removeAllChannels()));
console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

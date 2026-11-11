// Prueba E2E del chat (sorteo + chat libre) y Realtime contra Supabase local.
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
const idOf = Object.fromEntries(profiles.map((p) => [p.email.split('@')[0], p.id]));

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

const closed = await c.ana.rpc('start_conversation', {
  p_event_id: event.id,
  p_recipient_id: idOf.luis,
  p_anonymous: true,
  p_body: 'hola',
});
check(closed.error?.message === 'chat_closed', 'chat cerrado antes de publicar');
await c.admin.rpc('publish_draw', { p_event_id: event.id });

// Elegimos un giver (no admin) cuyo destinatario tampoco sea el admin.
let giverName, assignment;
for (const n of NAMES.filter((x) => x !== 'admin')) {
  const { data } = await c[n].rpc('get_my_assignment', { p_event_id: event.id });
  if (nameOf[data[0].receiver_id] !== 'admin') {
    giverName = n;
    assignment = data[0];
    break;
  }
}
const giver = c[giverName];
const receiverName = nameOf[assignment.receiver_id];
const receiver = c[receiverName];
const outsiderName = NAMES.find((n) => n !== giverName && n !== receiverName && n !== 'admin');
const outsider = c[outsiderName];
const conversations = async (client) =>
  (await client.rpc('get_my_conversations', { p_event_id: event.id })).data ?? [];

const giverThread = (await conversations(giver)).find((t) => t.is_my_recipient);
check(
  giverThread && giverThread.partner_name === assignment.full_name && !!giverThread.my_alias,
  `${giverName} ve su hilo con ${receiverName} y el alias con el que escribe`,
);
check(
  !(await conversations(receiver)).some((t) => t.thread_id === giverThread.thread_id),
  `${receiverName} no ve el hilo de quien le regala hasta que llega un mensaje`,
);

// Realtime: el receptor escucha TODOS sus mensajes (sin filtrar por hilo, como la app);
// el tercero y el admin intentan escuchar el hilo concreto.
const received = { receiver: [], outsider: [], admin: [] };
function listen(client, bucket, filter) {
  return new Promise((resolve, reject) => {
    // Sin límite, una suscripción que nunca confirma dejaría la prueba (y el CI) colgada.
    const timer = setTimeout(
      () => reject(new Error(`Realtime no confirmó la suscripción de "${bucket}" en 30 s`)),
      30_000,
    );
    client
      .channel(`t-${bucket}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', ...(filter ? { filter } : {}) },
        (p) => received[bucket].push(p.new),
      )
      .on('system', {}, (p) => {
        if (p.extension === 'postgres_changes' && p.status === 'ok') {
          clearTimeout(timer);
          resolve();
        }
      })
      .subscribe();
  });
}
// Igual que la app: esperar el token antes de suscribirse
for (const client of [receiver, outsider, c.admin]) await client.realtime.setAuth();
const threadFilter = `thread_id=eq.${giverThread.thread_id}`;
await Promise.all([
  listen(receiver, 'receiver'),
  listen(outsider, 'outsider', threadFilter),
  listen(c.admin, 'admin', threadFilter),
]);
await sleep(1000);

const t0 = Date.now();
const sent = await giver.rpc('send_thread_message', {
  p_thread_id: giverThread.thread_id,
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
check(!JSON.stringify(payload).includes(idOf[giverName]), 'el payload no contiene el id del giver');
await sleep(1000);
check(received.outsider.length === 0, 'un tercero suscrito al hilo NO recibe nada');
check(received.admin.length === 0, 'el ADMIN suscrito al hilo NO recibe nada');

// Chat libre: un tercero escribe EN SECRETO al mismo receptor para despistar
const free = await outsider.rpc('start_conversation', {
  p_event_id: event.id,
  p_recipient_id: assignment.receiver_id,
  p_anonymous: true,
  p_body: 'Te dejé un detallito 🎁',
});
check(!free.error, `${outsiderName} abre un chat anónimo con ${receiverName}`);
for (let i = 0; i < 50 && received.receiver.length < 2; i++) await sleep(100);
check(
  received.receiver.length === 2,
  `${receiverName} recibe en tiempo real el mensaje del chat nuevo, sin volver a suscribirse`,
);
check(
  !JSON.stringify(received.receiver[1] ?? {}).includes(idOf[outsiderName]),
  'el payload del chat libre tampoco identifica a quien escribe',
);

const recConvs = await conversations(receiver);
const anon = recConvs.filter((t) => [giverThread.thread_id, free.data].includes(t.thread_id));
const shape = (t) =>
  JSON.stringify([
    t.my_role,
    t.partner_name,
    t.partner_avatar_path,
    t.my_alias,
    t.is_my_recipient,
    t.partner_alias === null,
  ]);
check(anon.length === 2, `${receiverName} ve dos chats anónimos`);
check(
  anon.length === 2 && shape(anon[0]) === shape(anon[1]),
  'el de su amigo secreto real y el de despiste son indistinguibles',
);
check(
  !JSON.stringify(recConvs).includes(idOf[giverName]) &&
    !JSON.stringify(recConvs).includes(idOf[outsiderName]),
  'la bandeja del receptor no contiene ningún id de quien le escribe',
);

// Respuesta y no leídos
const reply = await receiver.rpc('send_thread_message', {
  p_thread_id: giverThread.thread_id,
  p_body: '¡Los libros!',
});
check(!reply.error, `${receiverName} responde`);
const unreadOf = async () =>
  (await conversations(giver)).find((t) => t.thread_id === giverThread.thread_id).unread;
check((await unreadOf()) === 1, 'el giver tiene 1 sin leer');
await giver.rpc('mark_thread_read', { p_thread_id: giverThread.thread_id });
check((await unreadOf()) === 0, 'tras abrirlo, 0 sin leer');

const { data: spy } = await outsider.from('messages').select('*');
check(
  (spy ?? []).every((m) => m.thread_id !== giverThread.thread_id),
  'el tercero no lee el hilo del sorteo por REST',
);
const { data: adminSpy } = await c.admin.from('messages').select('*');
check((adminSpy ?? []).length === 0, 'el admin no lee ningún mensaje por REST');
const freeSpy = await c.admin.from('free_threads').select('*');
check(!!freeSpy.error, 'el admin no puede leer quién abrió los chats libres');

await Promise.all(Object.values(c).map((cl) => cl.removeAllChannels()));
console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

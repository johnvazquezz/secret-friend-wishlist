// Prueba E2E de la Fase 4 (wishlist + gustos) contra Supabase local.
// Ejecutar con: npm run test:e2e  (ver e2e/README.md)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const URL = 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PW = 'Amigo2026local';
const NAMES = ['admin', 'ana', 'luis', 'maria', 'pedro', 'sofia', 'jorge'];

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
const { data: profiles } = await c.admin.from('profiles').select('id, email');
const idOf = Object.fromEntries(profiles.map((p) => [p.email.split('@')[0], p.id]));
const nameOf = Object.fromEntries(Object.entries(idOf).map(([n, id]) => [id, n]));

// Wishlist
const add = await c.ana.from('wishlist_items').insert([
  { title: 'Libro de cocina', url: 'https://example.com/libro', priority: 1, position: 0 },
  { title: 'Taza', url: null, priority: 2, position: 1 },
]);
check(!add.error, `Ana añade 2 deseos ${add.error?.message ?? ''}`);
const bad = await c.ana.from('wishlist_items').insert({ title: 'x', url: 'javascript:alert(1)' });
check(!!bad.error, 'la BD rechaza enlaces javascript:');
const { data: seen } = await c.luis.from('wishlist_items').select('title').eq('user_id', idOf.ana);
check(seen?.length === 2, 'Luis ve la lista de Ana');
const hijack = await c.luis
  .from('wishlist_items')
  .update({ title: 'Pirata' })
  .eq('user_id', idOf.ana)
  .select('id');
check((hijack.data ?? []).length === 0, 'Luis no puede editar la lista de Ana');

// Gustos (upsert dos veces: inserta y luego actualiza)
const p1 = await c.ana.from('user_preferences').upsert({ likes: 'Café', sizes: 'S' });
check(!p1.error, `Ana guarda sus gustos ${p1.error?.message ?? ''}`);
const p2 = await c.ana.from('user_preferences').upsert({ likes: 'Café y té', sizes: 'M' });
check(!p2.error, `Ana actualiza sus gustos ${p2.error?.message ?? ''}`);
const { data: mine } = await c.ana.from('user_preferences').select('likes, sizes').maybeSingle();
check(mine?.likes === 'Café y té' && mine.sizes === 'M', 'se leen los gustos actualizados');
const { data: spy } = await c.luis.from('user_preferences').select('*');
check((spy ?? []).length === 0, 'Luis no lee los gustos de Ana directamente');
const { data: adminSpy } = await c.admin.from('user_preferences').select('*');
check((adminSpy ?? []).length === 0, 'el admin tampoco');

// Sorteo publicado para comprobar el acceso del giver
const { data: event } = await c.admin
  .from('events')
  .insert({ name: 'E2E F4' })
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
const early = await c.luis.rpc('get_my_recipient_preferences', { p_event_id: event.id });
check(!early.error, 'RPC de gustos accesible');
const draw = await c.admin.rpc('run_draw', { p_event_id: event.id });
check(draw.data === 7, 'sorteo de 7');
await c.admin.rpc('publish_draw', { p_event_id: event.id });

let anaGiver = null;
let leaks = 0;
for (const n of NAMES) {
  const { data: a } = await c[n].rpc('get_my_assignment', { p_event_id: event.id });
  const { data: prefs } = await c[n].rpc('get_my_recipient_preferences', { p_event_id: event.id });
  const receiver = nameOf[a[0].receiver_id];
  if (receiver === 'ana') {
    anaGiver = n;
    check(prefs?.[0]?.likes === 'Café y té', `${n} (giver de Ana) ve sus gustos`);
  } else if ((prefs ?? []).length > 0) {
    leaks++;
  }
}
check(anaGiver !== null && leaks === 0, 'solo el giver de Ana ve los gustos de Ana');

console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

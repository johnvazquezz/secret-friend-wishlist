// Prueba del chat en el navegador real (dos sesiones). Uso: node chat-ui.mjs <repo> <outdir>
// Ejecutar con: npm run test:e2e:ui  (ver e2e/README.md)
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const out = process.env.E2E_SCREENSHOTS ?? path.join(process.cwd(), 'e2e', 'screenshots');
const { createClient } = require('@supabase/supabase-js');
const API = 'http://127.0.0.1:54321';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const PW = 'Amigo2026local';
const NAMES = ['ana', 'maria', 'pedro', 'sofia', 'jorge'];

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
async function api(name) {
  const c = createClient(API, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: `${name}@local.test`, password: PW });
  return c;
}

// Sorteo publicado (sin Luis, que tiene contraseña temporal)
const admin = await api('admin');
const { data: profiles } = await admin.from('profiles').select('id, email');
const idOf = Object.fromEntries(profiles.map((p) => [p.email.split('@')[0], p.id]));
const nameOf = Object.fromEntries(Object.entries(idOf).map(([n, id]) => [id, n]));
const { data: event } = await admin
  .from('events')
  .insert({ name: 'Navidad 2026', exchange_at: '2026-12-18T17:00:00Z' })
  .select('id')
  .single();
const people = [...NAMES, 'admin'];
await admin
  .from('event_participants')
  .insert(people.map((n) => ({ event_id: event.id, user_id: idOf[n] })));
await admin.rpc('open_event', { p_event_id: event.id });
for (const n of people)
  await admin.rpc('admin_set_participation', {
    p_event_id: event.id,
    p_user_id: idOf[n],
    p_status: 'confirmed',
  });
await admin.rpc('run_draw', { p_event_id: event.id });
await admin.rpc('publish_draw', { p_event_id: event.id });

let giverName, receiverName;
for (const n of NAMES) {
  const c = await api(n);
  const { data } = await c.rpc('get_my_assignment', { p_event_id: event.id });
  const r = nameOf[data[0].receiver_id];
  if (r !== 'admin') {
    giverName = n;
    receiverName = r;
    break;
  }
}
console.log(`giver=${giverName} receiver=${receiverName}`);

const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER_CHANNEL ?? 'msedge',
  headless: true,
});
const errors = [];
async function session(name, width = 1280, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'es-ES' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  await page.goto(`${APP}/login`);
  await page.getByLabel('Email').fill(`${name}@local.test`);
  await page.getByLabel('Contraseña').fill(PW);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: /Mensajes/ }).waitFor();
  return page;
}

const receiver = await session(receiverName, 390, 844); // el receptor, en móvil, en la página de inicio
const giver = await session(giverName);
await receiver.waitForTimeout(4000); // dar tiempo a que Realtime quede activo

// El enlace "Escríbele en secreto" de la tarjeta abre directamente el chat con su destinatario.
await giver.goto(`${APP}/mensajes?chat=amigo`);
const input = giver.getByLabel(/Escribe un mensaje a/);
await input.fill('¡Hola! Soy tu amigo secreto 🎅 ¿Prefieres libros o juegos?');
const sentAt = Date.now();
await input.press('Enter');

// Sin recargar: el badge de no leídos aparece en la navegación del receptor
await receiver.getByLabel('1 sin leer').waitFor({ timeout: 5000 });
check(true, `el badge "1 sin leer" aparece sin recargar (${Date.now() - sentAt} ms)`);
await receiver.screenshot({ path: path.join(out, '12-movil-badge.png') });

await receiver.getByRole('link', { name: /Mensajes/ }).click();
// En móvil se ve primero la bandeja; el chat nuevo sale como un anónimo más
const item = receiver
  .getByRole('navigation', { name: 'Conversaciones' })
  .getByRole('button')
  .first();
const itemText = await item.textContent();
check(
  itemText.includes('Anónimo') && !itemText.toLowerCase().includes('amigo secreto'),
  'el receptor ve un alias anónimo, sin la etiqueta "amigo secreto"',
);
await item.click();
await receiver.getByText('¿Prefieres libros o juegos?').waitFor();
const bodyText = await receiver.locator('body').innerText();
const giverFull = (
  await admin.from('profiles').select('full_name').eq('id', idOf[giverName]).single()
).data.full_name;
check(
  !bodyText.includes(giverFull),
  `el nombre del giver (${giverFull}) no aparece en la pantalla del receptor`,
);

await receiver.getByLabel(/Escribe un mensaje a/).fill('¡Juegos de mesa, por favor! 🎲');
await receiver.getByRole('button', { name: 'Enviar' }).click();
await giver.getByText('¡Juegos de mesa, por favor!').waitFor({ timeout: 5000 });
check(true, 'la respuesta llega al giver en tiempo real');

await receiver.waitForTimeout(500);
await receiver.screenshot({ path: path.join(out, '13-movil-chat-receptor.png'), fullPage: true });
await giver.screenshot({ path: path.join(out, '14-chat-giver.png'), fullPage: true });

await browser.close();
check(
  errors.length === 0,
  `sin errores en consola${errors.length ? ': ' + errors.join(' | ') : ''}`,
);
console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

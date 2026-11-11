// Chat libre en el navegador real: escribir en secreto a cualquier participante.
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

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

// Sorteo publicado con todos menos Luis (contraseña temporal) y el admin
const admin = createClient(API, ANON, { auth: { persistSession: false } });
await admin.auth.signInWithPassword({ email: 'admin@local.test', password: PW });
const { data: profiles } = await admin.from('profiles').select('id, email');
const { data: event } = await admin
  .from('events')
  .insert({ name: 'Navidad 2026' })
  .select('id')
  .single();
const ids = profiles
  .filter((p) => !p.email.startsWith('luis') && !p.email.startsWith('admin'))
  .map((p) => p.id);
await admin
  .from('event_participants')
  .insert(ids.map((user_id) => ({ event_id: event.id, user_id })));
await admin.rpc('open_event', { p_event_id: event.id });
for (const id of ids)
  await admin.rpc('admin_set_participation', {
    p_event_id: event.id,
    p_user_id: id,
    p_status: 'confirmed',
  });
await admin.rpc('run_draw', { p_event_id: event.id });
await admin.rpc('publish_draw', { p_event_id: event.id });

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

const pedro = await session('pedro', 390, 844);
const ana = await session('ana');
await pedro.waitForTimeout(4000); // Realtime activo

// 1. Ana escribe EN SECRETO a Pedro desde "Nuevo mensaje"
await ana.goto(`${APP}/mensajes`);
await ana.getByRole('button', { name: 'Nuevo mensaje' }).first().click();
const dialog = ana.getByRole('dialog', { name: 'Nuevo mensaje' });
check(
  (await dialog
    .getByRole('switch', { name: /Escribir en secreto/ })
    .getAttribute('aria-checked')) === 'true',
  'el modo secreto viene activado por defecto',
);
await dialog.getByRole('button', { name: /Pedro Ruiz/ }).click();
await dialog.getByLabel('Mensaje').fill('Te dejé un turrón en tu mesa 🍫');
await ana.screenshot({ path: path.join(out, '17-chat-libre-nuevo.png') });
await dialog.getByRole('button', { name: 'Enviar en secreto' }).click();
await ana.getByText('Mensaje enviado en secreto 🤫').waitFor();
await ana.getByText(/Escribes como «/).waitFor();
check(true, 'Ana envía el mensaje y ve con qué alias escribe');
await ana.screenshot({ path: path.join(out, '18-chat-libre-ana.png') });

// 2. Pedro lo recibe sin recargar y no puede saber que es Ana
await pedro
  .getByLabel(/1 sin leer/)
  .first()
  .waitFor({ timeout: 8000 });
check(true, 'a Pedro le aparece el mensaje sin recargar');
await pedro.getByRole('link', { name: /Mensajes/ }).click();
const item = pedro.getByRole('navigation', { name: 'Conversaciones' }).getByRole('button').first();
await item.click();
await pedro.getByText('Te dejé un turrón en tu mesa').waitFor();
await pedro.getByText(/Puede que sea tu amigo secreto, o puede que no/).waitFor();
const pedroText = await pedro.locator('body').innerText();
const pedroHtml = await pedro.content();
check(
  !pedroText.includes('Ana') && !pedroHtml.includes('Ana Pérez'),
  'en la página de Pedro no aparece "Ana" por ningún lado',
);
await pedro.screenshot({ path: path.join(out, '19-chat-libre-pedro.png'), fullPage: true });

// 3. Pedro responde y silencia; Ana ya no puede escribir
await pedro.getByLabel(/Escribe un mensaje a/).fill('¿Quién eres? 👀');
await pedro.getByRole('button', { name: 'Enviar' }).click();
await ana.getByText('¿Quién eres? 👀').waitFor({ timeout: 5000 });
check(true, 'la respuesta de Pedro le llega a Ana en tiempo real');

await pedro.getByRole('button', { name: 'Silenciar' }).click();
await pedro.getByRole('alertdialog').getByRole('button', { name: 'Silenciar' }).click();
await pedro.getByText('Silenciaste este chat').waitFor();
await ana.reload();
await ana.getByText('Esta persona silenció el chat').waitFor();
check(true, 'Pedro silencia el chat y Ana ya no puede escribir');

await browser.close();
check(
  errors.length === 0,
  `sin errores en consola${errors.length ? ': ' + errors.join(' | ') : ''}`,
);
console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

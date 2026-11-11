// Notificaciones en el navegador real. Uso: node notif-ui.mjs <repo> <outdir>
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

// Evento abierto con todos confirmados (aún sin sortear)
const admin = createClient(API, ANON, { auth: { persistSession: false } });
await admin.auth.signInWithPassword({ email: 'admin@local.test', password: PW });
const { data: profiles } = await admin.from('profiles').select('id, email');
const { data: event } = await admin
  .from('events')
  .insert({ name: 'Navidad 2026' })
  .select('id')
  .single();
const ids = profiles.filter((p) => !p.email.startsWith('luis')).map((p) => p.id);
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

const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER_CHANNEL ?? 'msedge',
  headless: true,
});
const errors = [];
async function session(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  await page.goto(`${APP}/login`);
  await page.getByLabel('Email').fill(`${name}@local.test`);
  await page.getByLabel('Contraseña').fill(PW);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: /Notificaciones/ }).waitFor();
  return page;
}

const ana = await session('ana');
// La campana aparece antes de que carguen las notificaciones: esperar a que llegue el contador.
await ana
  .getByRole('button', { name: 'Notificaciones (1 sin leer)' })
  .waitFor({ timeout: 8000 })
  .catch(() => {});
const before = await ana.getByRole('button', { name: /Notificaciones/ }).getAttribute('aria-label');
check(
  before === 'Notificaciones (1 sin leer)',
  `Ana tiene el aviso de inscripción abierta (${before})`,
);
await ana.getByRole('button', { name: /Notificaciones/ }).click();
await ana.getByText('¡Arrancó el Navidad 2026!').waitFor();
await ana.keyboard.press('Escape');
await ana.waitForTimeout(3000); // Realtime activo

// Confirma en el diálogo de la app (ya no se usan los diálogos nativos del navegador).
const confirmInApp = (page, label) =>
  page.getByRole('alertdialog').getByRole('button', { name: label }).click();

const adm = await session('admin');
await adm.goto(`${APP}/admin/evento`);
await adm.getByRole('button', { name: 'Hacer el sorteo' }).click();
await confirmInApp(adm, 'Sortear ahora');
await adm.getByRole('button', { name: 'Publicar resultados' }).click();
await confirmInApp(adm, 'Publicar');
await adm.getByRole('button', { name: 'Finalizar evento' }).waitFor();

const t0 = Date.now();
await ana.getByRole('button', { name: 'Notificaciones (1 sin leer)' }).waitFor({ timeout: 8000 });
check(true, `la campana de Ana se actualiza sola al publicar (${Date.now() - t0} ms)`);
await ana.getByRole('button', { name: 'Mostrar a quién le regalo' }).waitFor({ timeout: 8000 });
check(true, 'sin recargar, la página de Ana cambia a "Tu amigo secreto"');
await ana.getByRole('link', { name: /Mensajes/ }).waitFor({ timeout: 8000 });
check(true, 'y aparece el enlace a Mensajes');
check(
  (await ana.getByText('Ya no puedo participar').count()) === 0,
  'ya no se ofrece "Ya no puedo participar"',
);

await adm.getByLabel('Título').fill('Cambio de sala');
await adm
  .getByLabel('Mensaje (opcional)')
  .fill('El intercambio será en la terraza del piso 3. ¡Abrigaos!');
await adm.getByRole('button', { name: 'Enviar aviso' }).click();
await confirmInApp(adm, 'Enviar aviso');
await adm.getByText(/Llegó a \d+ personas/).waitFor();
check(true, 'el admin envía el aviso');

await ana.getByRole('button', { name: 'Notificaciones (2 sin leer)' }).waitFor({ timeout: 8000 });
check(true, 'el aviso llega a Ana en tiempo real');
await ana.getByRole('button', { name: /Notificaciones/ }).click();
await ana.getByText('Cambio de sala').waitFor();
await ana.waitForTimeout(300);
await ana.screenshot({ path: path.join(out, '15-notificaciones.png') });
await ana.keyboard.press('Escape');
await ana.getByRole('button', { name: 'Notificaciones' }).waitFor();
check(true, 'al abrirla se marcan como leídas');

await adm.screenshot({ path: path.join(out, '16-admin-aviso.png'), fullPage: true });
await browser.close();
check(
  errors.length === 0,
  `sin errores en consola${errors.length ? ': ' + errors.join(' | ') : ''}`,
);
console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

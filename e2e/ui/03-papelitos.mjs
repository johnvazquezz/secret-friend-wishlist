// Sorteo con papelitos en el navegador real.
// Ejecutar con: npm run test:e2e:ui  (ver e2e/README.md)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const out = process.env.E2E_SCREENSHOTS ?? path.join(process.cwd(), 'e2e', 'screenshots');
mkdirSync(out, { recursive: true });
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

// Evento en borrador con todos menos el admin
const api = createClient(API, ANON, { auth: { persistSession: false } });
await api.auth.signInWithPassword({ email: 'admin@local.test', password: PW });
const { data: profiles } = await api.from('profiles').select('id, email');
const { data: event } = await api
  .from('events')
  .insert({ name: 'Navidad 2026' })
  .select('id')
  .single();
await api
  .from('event_participants')
  .insert(
    profiles
      .filter((p) => !p.email.startsWith('admin'))
      .map((p) => ({ event_id: event.id, user_id: p.id })),
  );

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
  page.on('dialog', (d) => d.accept());
  await page.goto(`${APP}/login`);
  await page.getByLabel('Email').fill(`${name}@local.test`);
  await page.getByLabel('Contraseña').fill(PW);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: /Notificaciones/ }).waitFor();
  return page;
}

// 1. El admin indica que el sorteo ya se hizo
const adm = await session('admin');
await adm.goto(`${APP}/admin/evento`);
await adm.getByRole('button', { name: 'El sorteo ya se hizo (papelitos)' }).click();
await adm.getByText(/0 de 6 participantes ya registraron/).waitFor();
check(true, 'el admin pasa el evento a papelitos y ve 0 de 6 registrados');

// 2. Ana registra a Luis
const ana = await session('ana');
await ana.getByRole('heading', { name: 'Registra a tu amigo secreto' }).waitFor();
const options = await ana.getByLabel('Persona de tu papelito').locator('option').allTextContents();
check(!options.some((o) => o.startsWith('Ana')), 'Ana no aparece en su propia lista');
await ana.screenshot({ path: path.join(out, 'papelitos-registro.png'), fullPage: true });
await ana.getByLabel('Persona de tu papelito').selectOption({ label: 'Luis Gómez — Operaciones' });
await ana.getByRole('button', { name: 'Registrar' }).click();
await ana.getByRole('button', { name: 'Mostrar a quién le regalo' }).click();
await ana.getByText('Luis Gómez').first().waitFor();
await ana.getByRole('button', { name: 'Me equivoqué de persona' }).waitFor();
check(true, 'Ana ve a Luis y puede corregir mientras no haya mensajes');
await ana.screenshot({ path: path.join(out, 'papelitos-registrado.png'), fullPage: true });

// 3. María intenta registrar a Luis
const maria = await session('maria');
await maria
  .getByLabel('Persona de tu papelito')
  .selectOption({ label: 'Luis Gómez — Operaciones' });
await maria.getByRole('button', { name: 'Registrar' }).click();
const alert = await maria.getByRole('alert').textContent();
check(
  /ya está registrada por otro participante/.test(alert) && !/Ana/.test(alert),
  'María ve que Luis ya está registrado, sin saber por quién',
);

// 4. El admin ve el progreso y puede liberar
await adm.reload();
await adm.getByText(/1 de 6 participantes ya registraron/).waitFor();
check(true, 'el admin ve 1 de 6 registrados');
await adm.screenshot({ path: path.join(out, 'papelitos-admin.png'), fullPage: true });

const relevant = errors.filter((e) => !/Failed to load resource.*(400|409)/.test(e));
check(
  relevant.length === 0,
  `sin errores en la consola${relevant.length ? `: ${relevant.join(' | ')}` : ''}`,
);

await browser.close();
console.log(failures ? `\n${failures} FALLOS` : '\nTODO OK');
process.exit(failures ? 1 : 0);

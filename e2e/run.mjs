// Ejecuta las pruebas E2E contra Supabase local.
//   npm run test:e2e       → pruebas de API (base de datos, Auth, Edge Functions, Realtime)
//   npm run test:e2e:ui    → pruebas en el navegador (requiere `npm run dev` en marcha)
// Antes de cada prueba se reinicia la base de datos (`supabase db reset`) para partir del seed.
import { execSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const suite = process.argv.includes('--ui') ? 'ui' : 'api';
const dir = path.join(root, suite);
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.mjs'))
  .sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForStack() {
  // Tras un reset, Auth, Edge Functions y Realtime tardan unos segundos en estar listos.
  for (let i = 0; i < 60; i++) {
    try {
      const fn = await fetch('http://127.0.0.1:54321/functions/v1/admin-users', {
        method: 'OPTIONS',
      });
      const auth = await fetch('http://127.0.0.1:54321/auth/v1/health', {
        headers: { apikey: 'x' },
      });
      if (fn.ok && auth.status < 500) break;
    } catch {
      /* aún arrancando */
    }
    await sleep(1000);
  }
  await sleep(10_000); // margen para Realtime
}

let failed = 0;
for (const file of files) {
  console.log(`\n▶ ${suite}/${file}`);
  execSync('npx supabase db reset', { stdio: 'ignore' });
  await waitForStack();
  const result = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed++;
}

execSync('npx supabase db reset', { stdio: 'ignore' });
console.log(
  `\n${failed === 0 ? '✅' : '❌'} ${files.length - failed}/${files.length} pruebas E2E (${suite}) correctas`,
);
process.exit(failed === 0 ? 0 : 1);

// Entorno de pruebas local: una copia de producción en tu PC, con Docker.
//
//   npm run local:up            Supabase local + Edge Functions + push + app en http://localhost:8080
//   npm run local:up:demo       Lo mismo y, si no hay evento activo, carga datos de demo
//   npm run local:reset         Base de datos limpia (seed) y vuelve a configurar push
//   npm run local:reset:demo    Base limpia + datos de demo
//   npm run local:status        Qué está corriendo
//   npm run local:down          Para todo (los datos de la base se conservan)
//
// Nunca toca producción: no usa --linked ni --project-ref.
import { spawnSync } from 'node:child_process';
import { createECDH, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_ENV = path.join(root, 'supabase', 'functions', '.env.local');
const FRONT_ENV = path.join(root, '.env.local');
const DEMO_SQL = path.join(root, 'supabase', 'demo.sql');
const PROJECT_ID = readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8').match(
  /^project_id\s*=\s*"([^"]+)"/m,
)[1];
const DB_CONTAINER = `supabase_db_${PROJECT_ID}`;
// La base llama a la función por la red interna de Docker (kong), no por 127.0.0.1.
const PUSH_FUNCTION_URL = `http://supabase_kong_${PROJECT_ID}:8000/functions/v1/send-push`;
const WEB_PORT = process.env.LOCAL_WEB_PORT ?? '8080';
// Servicios de Supabase que no hacen falta para probar la app (arranca más rápido).
const EXCLUDE = 'imgproxy,vector,logflare,supavisor,mailpit';
const isWindows = process.platform === 'win32';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const step = (msg) => console.log(`\n▶ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

function run(cmd, args, { env, input, capture = false, allowFail = false } = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
    shell: isWindows, // npx/docker en Windows necesitan la shell
    stdio: capture || input !== undefined ? 'pipe' : 'inherit',
  });
  if (result.status !== 0 && !allowFail) {
    if (capture || input !== undefined) process.stderr.write(result.stderr ?? '');
    throw new Error(`Falló: ${cmd} ${args.join(' ')}`);
  }
  return result;
}

const supabase = (args, opts) => run('npx', ['supabase', ...args], opts);

function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---------------------------------------------------------------------------
// Secretos locales de push (claves VAPID de DESARROLLO, nunca las de producción)
// ---------------------------------------------------------------------------
function ensureFunctionsEnv() {
  const current = parseEnvFile(FUNCTIONS_ENV);
  if (current.VAPID_PUBLIC_KEY && current.VAPID_PRIVATE_KEY && current.PUSH_WEBHOOK_SECRET) {
    return { VAPID_SUBJECT: 'mailto:admin@local.test', ...current };
  }
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const secrets = {
    VAPID_PUBLIC_KEY: base64url(ecdh.getPublicKey()),
    VAPID_PRIVATE_KEY: base64url(ecdh.getPrivateKey()),
    VAPID_SUBJECT: 'mailto:admin@local.test',
    PUSH_WEBHOOK_SECRET: randomBytes(24).toString('hex'),
  };
  writeFileSync(
    FUNCTIONS_ENV,
    '# Secretos de DESARROLLO para las Edge Functions locales (ignorado por git).\n' +
      Object.entries(secrets)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') +
      '\n',
  );
  ok('claves VAPID de desarrollo creadas en supabase/functions/.env.local');
  return secrets;
}

/** Mantiene VITE_VAPID_PUBLIC_KEY de .env.local igual a la clave local (para `npm run dev`). */
function syncFrontEnv(publicKey) {
  const text = existsSync(FRONT_ENV) ? readFileSync(FRONT_ENV, 'utf8') : '';
  const line = `VITE_VAPID_PUBLIC_KEY=${publicKey}`;
  if (text.includes(line)) return;
  const next = /^VITE_VAPID_PUBLIC_KEY=.*$/m.test(text)
    ? text.replace(/^VITE_VAPID_PUBLIC_KEY=.*$/m, line)
    : `${text.trimEnd()}\n${line}\n`;
  writeFileSync(FRONT_ENV, next.trimStart());
  ok('VITE_VAPID_PUBLIC_KEY actualizada en .env.local');
}

// ---------------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------------
function requireDocker() {
  if (run('docker', ['info'], { capture: true, allowFail: true }).status !== 0) {
    throw new Error('Docker no está encendido. Abre Docker Desktop y vuelve a intentarlo.');
  }
}

function supabaseStatus() {
  const res = supabase(['status', '-o', 'env'], { capture: true, allowFail: true });
  if (res.status !== 0) return null;
  const vars = Object.fromEntries(
    [...res.stdout.matchAll(/^([A-Z_]+)="?([^"\r\n]*)"?$/gm)].map((m) => [m[1], m[2]]),
  );
  return vars.API_URL ? vars : null;
}

/** ¿La función send-push tiene sus secretos? (401 = sí; 500 "no configurado" = no) */
async function pushFunctionConfigured(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/functions/v1/send-push`, { method: 'POST', body: '{}' });
    return res.status === 401;
  } catch {
    return false;
  }
}

async function startSupabase(secrets) {
  step('Supabase local (base de datos, Auth, Realtime, Storage, Edge Functions)');
  let status = supabaseStatus();
  if (status && !(await pushFunctionConfigured(status.API_URL))) {
    // Estaba arrancado sin los secretos de push: hay que reiniciarlo para pasárselos.
    console.log('  Reiniciando Supabase para cargar los secretos de las Edge Functions…');
    supabase(['stop']);
    status = null;
  }
  if (!status) {
    supabase(['start', '-x', EXCLUDE], { env: secrets });
    status = supabaseStatus();
  }
  if (!status) throw new Error('Supabase no arrancó. Revisa la salida de arriba.');
  ok(`API en ${status.API_URL}`);
  return status;
}

function psql(sql) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
    ],
    { input: sql },
  );
}

function configureVault(secret) {
  step('Push: Vault apunta a la Edge Function local');
  psql(`
    delete from vault.secrets where name in ('push_function_url', 'push_webhook_secret');
    select vault.create_secret('${PUSH_FUNCTION_URL}', 'push_function_url');
    select vault.create_secret('${secret}', 'push_webhook_secret');
  `);
  ok('push_function_url y push_webhook_secret configurados');
}

function loadDemo() {
  step('Datos de demo');
  const res = psql(readFileSync(DEMO_SQL, 'utf8'));
  const notice = (res.stderr ?? '').match(/NOTICE:\s+(.*)/);
  ok(notice ? notice[1] : 'listo');
}

function startWeb(status, publicKey) {
  step(`App compilada como en producción (nginx) en http://localhost:${WEB_PORT}`);
  run('docker', ['compose', 'up', '-d', '--build', 'web'], {
    env: {
      VITE_SUPABASE_URL: status.API_URL,
      VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
      VITE_VAPID_PUBLIC_KEY: publicKey,
      LOCAL_WEB_PORT: WEB_PORT,
    },
  });
  ok('contenedor secret-friend-wishlist-web en marcha');
}

function summary(status) {
  console.log(`
────────────────────────────────────────────────────────────
  Entorno de pruebas listo

  App ............ http://localhost:${WEB_PORT}
  Supabase API ... ${status.API_URL}
  Studio (BD) .... ${status.STUDIO_URL ?? 'http://127.0.0.1:54323'}

  Cuentas: admin | ana | luis | maria | pedro | sofia | jorge
           <nombre>@local.test  ·  contraseña: Amigo2026local

  Push: actívalo en Mi perfil (en Edge/Chrome normal, no en
  ventana privada). Para probar con dos personas, usa otro
  navegador o un perfil distinto.

  Parar: npm run local:down   (los datos se conservan)
────────────────────────────────────────────────────────────`);
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------
async function up({ demo }) {
  requireDocker();
  const secrets = ensureFunctionsEnv();
  syncFrontEnv(secrets.VAPID_PUBLIC_KEY);
  const status = await startSupabase(secrets);
  configureVault(secrets.PUSH_WEBHOOK_SECRET);
  if (demo) loadDemo();
  startWeb(status, secrets.VAPID_PUBLIC_KEY);
  summary(status);
}

async function reset({ demo }) {
  requireDocker();
  const secrets = ensureFunctionsEnv();
  step('Base de datos limpia (migraciones + seed)');
  supabase(['db', 'reset'], { env: secrets });
  const status = supabaseStatus();
  configureVault(secrets.PUSH_WEBHOOK_SECRET);
  if (demo) loadDemo();
  summary(status);
}

function down() {
  step('Parando la app');
  run('docker', ['compose', 'down'], { allowFail: true, env: { VITE_SUPABASE_ANON_KEY: '-' } });
  step('Parando Supabase local (los datos se conservan)');
  supabase(['stop'], { allowFail: true });
  ok('todo parado');
}

function status() {
  run('docker', ['compose', 'ps'], { allowFail: true, env: { VITE_SUPABASE_ANON_KEY: '-' } });
  supabase(['status'], { allowFail: true });
}

const [command = 'up', ...flags] = process.argv.slice(2);
const options = { demo: flags.includes('--demo') };
const commands = { up, reset, down, status };

if (!commands[command]) {
  console.error(
    `Comando desconocido: ${command}. Usa: up [--demo] | reset [--demo] | status | down`,
  );
  process.exit(1);
}

try {
  await commands[command](options);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
}

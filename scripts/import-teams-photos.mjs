// Importa la foto de perfil de Microsoft 365 / Teams de cada usuario de la app (por su email).
//
//   npm run photos:teams -- --dry-run     muestra qué haría, sin subir nada
//   npm run photos:teams                  sube las fotos de quien aún no tiene foto en la app
//   npm run photos:teams -- --overwrite   reemplaza también las fotos que ya existen
//
// Necesita:
//   * Haber iniciado sesión en el CLI de Supabase (`npx supabase login`) y enlazado el proyecto
//     (`npx supabase link`). De ahí se obtiene la clave de servicio; no se guarda en ningún sitio.
//     (También se pueden pasar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY por variables de entorno.)
//   * Una cuenta de la empresa en Microsoft 365. El script muestra un código para iniciar sesión en
//     el navegador y pide solo el permiso de lectura de perfiles básicos (User.ReadBasic.All).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const OVERWRITE = args.has('--overwrite');

// Aplicación pública de Microsoft "Microsoft Graph Command Line Tools" (la de Microsoft Graph
// PowerShell): permite iniciar sesión con código sin registrar una aplicación propia.
const MS_CLIENT_ID = process.env.MS_CLIENT_ID ?? '14d82eec-204b-4c2f-b7e8-296a70dab67e';
const MS_TENANT = process.env.MS_TENANT ?? 'organizations';
const GRAPH = process.env.GRAPH_BASE_URL ?? 'https://graph.microsoft.com/v1.0';
const MAX_BYTES = 1024 * 1024; // límite del bucket

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
function supabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  }
  let ref;
  try {
    ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  } catch {
    throw new Error(
      'No hay proyecto enlazado. Ejecuta `npx supabase link --project-ref <ref>` o define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  const raw = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' },
  );
  const key = JSON.parse(raw).find((k) => k.name === 'service_role')?.api_key;
  if (!key)
    throw new Error('No se pudo obtener la clave de servicio (¿hiciste `npx supabase login`?).');
  return { url: `https://${ref}.supabase.co`, key };
}

async function sb(cfg, path, init = {}) {
  const res = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, ...init.headers },
  });
  if (!res.ok)
    throw new Error(`Supabase ${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res;
}

// ---------------------------------------------------------------------------
// Microsoft Graph: inicio de sesión con código (device code flow)
// ---------------------------------------------------------------------------
async function graphToken() {
  if (process.env.GRAPH_TOKEN) return process.env.GRAPH_TOKEN;
  const base = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0`;
  const scope = 'https://graph.microsoft.com/User.ReadBasic.All';
  const dc = await (
    await fetch(`${base}/devicecode`, {
      method: 'POST',
      body: new URLSearchParams({ client_id: MS_CLIENT_ID, scope }),
    })
  ).json();
  if (!dc.device_code)
    throw new Error(`Microsoft rechazó el inicio de sesión: ${JSON.stringify(dc)}`);

  console.log(`\n👉 ${dc.message}\n   (inicia sesión con tu cuenta de la empresa)\n`);
  const deadline = Date.now() + dc.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep((dc.interval ?? 5) * 1000);
    const tok = await (
      await fetch(`${base}/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: MS_CLIENT_ID,
          device_code: dc.device_code,
        }),
      })
    ).json();
    if (tok.access_token) return tok.access_token;
    if (tok.error === 'authorization_pending' || tok.error === 'slow_down') continue;
    if (tok.error_codes?.includes(65001) || /consent/i.test(tok.error_description ?? '')) {
      throw new Error(
        'Tu empresa exige que un administrador de Microsoft 365 apruebe el permiso "User.ReadBasic.All". ' +
          'Sin eso, cada persona puede subir su foto desde "Mi perfil" o el admin desde "Usuarios".',
      );
    }
    throw new Error(`Inicio de sesión fallido: ${tok.error_description ?? tok.error}`);
  }
  throw new Error('El código caducó. Vuelve a ejecutar el script.');
}

/** Foto de 240×240 (o la original si no hay ese tamaño). null si la persona no tiene foto. */
async function fetchPhoto(token, email) {
  const headers = { Authorization: `Bearer ${token}` };
  for (const path of ['photos/240x240/$value', 'photo/$value']) {
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(email)}/${path}`, { headers });
    if (res.ok) {
      return {
        bytes: Buffer.from(await res.arrayBuffer()),
        type: res.headers.get('content-type') ?? 'image/jpeg',
      };
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Microsoft denegó el acceso a las fotos (${res.status}). ${await res.text()}`,
      );
    }
    // 404: sin foto en ese tamaño; se prueba el siguiente
  }
  return null;
}

// ---------------------------------------------------------------------------
const cfg = supabaseConfig();
const profiles = await (
  await sb(cfg, '/rest/v1/profiles?select=id,email,full_name,avatar_path,is_active&order=full_name')
).json();
console.log(
  `Proyecto: ${cfg.url} · ${profiles.length} usuarios${DRY_RUN ? ' · MODO PRUEBA (no se sube nada)' : ''}`,
);

const token = await graphToken();
const summary = { subidas: 0, sinFoto: 0, conservadas: 0, errores: 0 };

for (const p of profiles) {
  const label = `${p.full_name} <${p.email}>`;
  if (p.avatar_path && !OVERWRITE) {
    console.log(`=  ${label}: ya tiene foto en la app (usa --overwrite para reemplazarla)`);
    summary.conservadas++;
    continue;
  }
  try {
    const photo = await fetchPhoto(token, p.email);
    if (!photo) {
      console.log(`·  ${label}: sin foto en Microsoft 365`);
      summary.sinFoto++;
      continue;
    }
    if (photo.bytes.length > MAX_BYTES || !/^image\/(jpeg|png|webp)$/.test(photo.type)) {
      console.log(`!  ${label}: foto no válida (${photo.type}, ${photo.bytes.length} bytes)`);
      summary.errores++;
      continue;
    }
    if (!DRY_RUN) {
      // Ruta fija que exige la base de datos; el tipo real (jpeg/png) va en la cabecera.
      const objectPath = `${p.id}/avatar.webp`;
      await sb(cfg, `/storage/v1/object/avatars/${objectPath}`, {
        method: 'POST',
        headers: { 'Content-Type': photo.type, 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
        body: photo.bytes,
      });
      await sb(cfg, `/rest/v1/profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ avatar_path: objectPath }),
      });
    }
    console.log(`✓  ${label}: ${DRY_RUN ? 'tiene foto (se subiría)' : 'foto importada'}`);
    summary.subidas++;
  } catch (err) {
    console.log(`✗  ${label}: ${err.message}`);
    summary.errores++;
    if (/denegó el acceso/.test(err.message)) break; // sin permiso no tiene sentido seguir
  }
}

console.log(
  `\n${DRY_RUN ? 'Se importarían' : 'Importadas'}: ${summary.subidas} · sin foto en Microsoft: ${summary.sinFoto} · ` +
    `ya tenían foto: ${summary.conservadas} · errores: ${summary.errores}`,
);
process.exit(summary.errores ? 1 : 0);

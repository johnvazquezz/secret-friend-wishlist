# Despliegue a producción

Tiempo estimado: 30–45 minutos. Necesitas acceso de administrador al proyecto de Supabase y a
Vercel (o al hosting que uses).

## 0. ¿Proyecto nuevo o el de la versión anterior?

La versión anterior de la app usaba un proyecto de Supabase con la tabla `team_members` y
**políticas que exponen los códigos de acceso**. Hay dos opciones:

- **Recomendado: proyecto nuevo.** Empiezas limpio y luego pausas o borras el antiguo.
- **Reutilizar el proyecto antiguo.** Las migraciones cierran la exposición
  (`20261102120000_lock_team_members.sql`). Si la primera migración se aplicó desde el dashboard
  (sin el CLI), márcala como aplicada **antes** de `db push`, o fallará al recrear las políticas:

  ```bash
  npx supabase migration repair --status applied 20251028171742
  ```

> Mientras la versión antigua siga publicada, cualquiera puede leer los códigos de acceso. Si no
> vas a migrar ya, al menos pausa el proyecto antiguo o borra sus políticas `USING (true)`.

## 1. Supabase

1. Crea el proyecto (plan **Pro** recomendado: el gratuito se pausa tras una semana sin uso).
   Elige la región más cercana a la empresa.
2. Enlaza y aplica las migraciones:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

   Esto crea tablas, RLS, funciones, el bucket `avatars`, Realtime y la tarea diaria de
   recordatorios (pg_cron).

3. Despliega la Edge Function de gestión de usuarios (la de push se configura en el
   [paso 5](#5-notificaciones-push)):

   ```bash
   npx supabase functions deploy admin-users
   ```

4. **Authentication → Sign In / Providers**
   - Desactiva **Allow new users to sign up** (nadie se registra solo).
   - Deja **Email** habilitado. Desactiva **Confirm email** (las cuentas las crea el admin).
   - **Password**: longitud mínima **10**, requisito **Letters and digits**.
5. **Authentication → Rate Limits**: sube los límites por IP (ver
   [Muchas personas desde la misma red](#muchas-personas-desde-la-misma-red)).
6. **Authentication → URL Configuration**: `Site URL` = URL pública de la app.
7. **Database → Backups**: comprueba que los backups diarios están activos (plan Pro).

## 2. Primer administrador

1. *Authentication → Users → Add user* con tu email y una contraseña (marca *Auto Confirm*).
2. En *SQL Editor*:

   ```sql
   update public.profiles
   set role = 'admin', must_change_password = false
   where email = 'tu-email@empresa.com';
   ```

El resto de cuentas se crean desde la app (*Usuarios › Agregar usuarios*).

## 3. Frontend (Vercel)

1. Importa el repositorio en Vercel (framework: Vite). Build `npm run build`, salida `dist`.
2. Variables de entorno (Production y Preview):
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = clave **anon/publishable** (nunca la `service_role`).
3. `vercel.json` ya incluye la reescritura para rutas de la SPA y cabeceras de seguridad (CSP,
   `X-Frame-Options`, etc.). La CSP permite `*.supabase.co`; si usas un dominio propio para
   Supabase, añádelo a `connect-src` e `img-src`.

## 4. Comprobación final (10 minutos)

- [ ] Entrar con el admin. Crear 2–3 cuentas de prueba desde *Usuarios*.
- [ ] Entrar con una cuenta de prueba: obliga a cambiar la contraseña.
- [ ] Subir una foto de perfil y añadir un deseo.
- [ ] Crear un evento de prueba, abrir inscripción, confirmar, sortear, publicar.
- [ ] Cada cuenta ve solo a su destinatario; el chat funciona en tiempo real entre dos navegadores.
- [ ] En el navegador, *DevTools → Network*: ninguna respuesta contiene `access_code` ni
      `giver_id`.
- [ ] Finalizar y **eliminar** los datos de prueba antes de crear el evento real
      (un evento en borrador se puede borrar; uno finalizado queda archivado).
- [ ] Notificaciones push: ver las pruebas del [paso 5](#pruebas-de-push).

## 5. Notificaciones push

Opcional pero recomendado. Sin esta configuración la app funciona igual; simplemente no aparece
la opción de activar notificaciones.

### Claves y secrets (una sola vez)

1. Genera el par de claves VAPID (guárdalas en el gestor de contraseñas de la empresa: si cambian,
   todas las suscripciones se renuevan solas, pero los dispositivos que no abran la app dejarán de
   recibir avisos):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Genera un secreto aleatorio para que solo la base de datos pueda llamar a la función:

   ```bash
   openssl rand -hex 32
   ```

3. Guarda los secrets de la Edge Function y despliégala:

   ```bash
   npx supabase secrets set \
     VAPID_PUBLIC_KEY=<clave pública> \
     VAPID_PRIVATE_KEY=<clave privada> \
     VAPID_SUBJECT=mailto:<email de contacto del organizador> \
     PUSH_WEBHOOK_SECRET=<secreto del paso 2>
   npx supabase functions deploy send-push
   ```

   `send-push` se despliega con `verify_jwt = false` (está en `supabase/config.toml`): no la llaman
   usuarios sino la base de datos, y se protege con `PUSH_WEBHOOK_SECRET`.

4. En *SQL Editor*, guarda en **Vault** la URL de la función y el mismo secreto. Es lo que usan
   los triggers de `messages` y `notifications` (equivale a un *Database Webhook*, pero versionado
   en la migración `20261122100000_web_push.sql`):

   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
   select vault.create_secret('<secreto del paso 2>', 'push_webhook_secret');
   ```

   Para cambiarlos más adelante: `select vault.update_secret(id, '<nuevo valor>') from
   vault.secrets where name = 'push_webhook_secret';` (y lo mismo en `supabase secrets set`).

5. En Vercel (Production y Preview), añade `VITE_VAPID_PUBLIC_KEY` = la clave **pública** y
   vuelve a desplegar. **Nunca** pongas la clave privada ni la `service_role` en Vercel.

### Cómo funciona

```
INSERT en messages / notifications
  → trigger (calcula destinatario y título: nombre o alias)
  → pg_net → Edge Function send-push (web-push + VAPID)
  → servicio push del navegador (FCM, Apple, Mozilla, Windows)
  → service worker public/sw.js → notificación
```

- No se envía nada a quien escribe, ni a quien silenció el chat, ni a cuentas desactivadas.
- Si el chat ya está abierto y visible, el service worker no muestra la notificación.
- Suscripciones caducadas (el servicio responde 404/410) se borran solas.

### Pruebas de push

- [ ] **Suscripción**: en *Mi perfil → Activar notificaciones* aparece el permiso; tras aceptar,
      *Table Editor → push_subscriptions* tiene una fila nueva.
- [ ] **Android con la app cerrada**: cierra Chrome por completo, escribe desde otra cuenta → llega
      la notificación; al tocarla se abre la conversación.
- [ ] **iPhone**: en Safari, *Mi perfil* muestra los pasos. Tras *Añadir a pantalla de inicio*,
      abre la app desde el icono, activa las notificaciones y repite la prueba anterior.
- [ ] **Anonimato**: un mensaje en secreto llega con el alias (🦌…), nunca con el nombre.
- [ ] **Remitente**: quien escribe no recibe su propio push.
- [ ] **Chat abierto**: con la conversación abierta y en primer plano no llega push; con otra
      abierta, sí.
- [ ] **Avisos**: *Evento › Enviar un aviso* llega como push a quien tiene la app cerrada.
- [ ] **Caducada**: desinstala la PWA o revoca el permiso; tras el siguiente envío, la fila
      desaparece de `push_subscriptions` (el log dice `caducadas=1`).
- [ ] **Cerrar sesión**: la fila de ese dispositivo desaparece.

### Depuración

- Navegador: *DevTools → Application → Service Workers* (estado de `sw.js`; el botón **Push**
  simula un envío, p. ej. `{"kind":"chat","title":"Prueba","body":"Hola","url":"/mensajes"}`) y
  *Application → Manifest* (iconos e instalabilidad).
- Edge Function: *Dashboard → Edge Functions → send-push → Logs* (una línea por envío con
  `ok`, `caducadas` y `fallos`; nunca el contenido).
- Llamadas de la base de datos a la función:

  ```sql
  select created, status_code, content from net._http_response order by created desc limit 20;
  ```

  `401` = el secreto de Vault no coincide con `PUSH_WEBHOOK_SECRET`. Sin filas = falta la
  configuración de Vault.
- Android: comprueba que Chrome tenga permitidas las notificaciones en los ajustes del sistema y
  que el ahorro de batería no lo restrinja.

### En local

```bash
npm run db:start
# supabase/functions/.env.local (ignorado por git) con VAPID_*, VAPID_SUBJECT y PUSH_WEBHOOK_SECRET
npx supabase functions serve --env-file supabase/functions/.env.local
```

En *SQL* local, apunta Vault a la función a través de la red de Docker:

```sql
select vault.create_secret('http://supabase_kong_secret-friend-wishlist:8000/functions/v1/send-push', 'push_function_url');
select vault.create_secret('<PUSH_WEBHOOK_SECRET de .env.local>', 'push_webhook_secret');
```

Y en `.env.local` del front, `VITE_VAPID_PUBLIC_KEY`. `localhost` cuenta como contexto seguro, así
que no hace falta HTTPS (para probar en un celular real sí: usa un despliegue de *Preview*).
`npm run db:reset` borra Vault: hay que volver a crear los dos secretos.

## Entornos

| Entorno    | Supabase                    | Frontend               |
| ---------- | --------------------------- | ---------------------- |
| Local      | `npm run db:start` (Docker) | `npm run dev`          |
| Staging    | proyecto Supabase aparte    | Vercel *Preview*       |
| Producción | proyecto Supabase principal | Vercel *Production*    |

Las migraciones nuevas se prueban primero en local (`npm run db:reset && npm run db:test &&
npm run test:e2e`), luego en staging y por último en producción con `npx supabase db push`.

Las migraciones se aplican **a mano** con `npx supabase db push`, y Vercel publica el frontend en
cuanto un cambio llega a `main`. Si un cambio trae migraciones, aplícalas **antes** de fusionar en
`main`: si no, la web nueva llama a funciones que aún no existen en la base de datos.

## Muchas personas desde la misma red

Supabase Auth limita las peticiones **por dirección IP**. En una oficina todo el mundo sale a
internet con la misma IP pública, así que para Supabase decenas de compañeros entrando a la vez son
"una sola IP haciendo muchas peticiones".

- El límite que importa es **Token refresh** (por defecto, 150 cada 5 minutos por IP). Cubre el
  endpoint `/token`, que usan **tanto los inicios de sesión con email y contraseña como las
  renovaciones automáticas de sesión** (cada pestaña abierta renueva su sesión cada hora).
- Al superarlo, Supabase responde `429` (`over_request_rate_limit`): no deja entrar y, a quien ya
  está dentro, se le caduca la sesión y la app empieza a fallar.
- La app avisa con "Hay mucha gente entrando a la vez. Espera un minuto…" y bloquea el botón 60 s
  para que los reintentos no alarguen el bloqueo.

**Cómo confirmarlo**: *Logs → Auth* (o *Logs Explorer*), buscar respuestas `429` /
`over_request_rate_limit` a la hora del problema.

**Valores recomendados** en *Authentication → Rate Limits* (unas 100 personas detrás de la misma
IP):

| Límite                      | Por defecto      | Recomendado       |
| --------------------------- | ---------------- | ----------------- |
| Token refresh               | 150 / 5 min / IP | **1500** / 5 min  |
| Sign-ups and sign-ins       | 30 / 5 min / IP  | **300** / 5 min   |
| Token verifications         | 30 / 5 min / IP  | **300** / 5 min   |

Los mismos valores están en `supabase/config.toml` como referencia. En local no se nota: el
servidor de Auth local no limita por IP.

Alternativa sin tocar los límites: el día del arranque, repartir las credenciales por grupos (por
ejemplo, 20 personas cada 5 minutos).

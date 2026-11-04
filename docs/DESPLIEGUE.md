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

3. Despliega la Edge Function de gestión de usuarios:

   ```bash
   npx supabase functions deploy admin-users
   ```

4. **Authentication → Sign In / Providers**
   - Desactiva **Allow new users to sign up** (nadie se registra solo).
   - Deja **Email** habilitado. Desactiva **Confirm email** (las cuentas las crea el admin).
   - **Password**: longitud mínima **10**, requisito **Letters and digits**.
5. **Authentication → URL Configuration**: `Site URL` = URL pública de la app.
6. **Database → Backups**: comprueba que los backups diarios están activos (plan Pro).

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

## Entornos

| Entorno    | Supabase                    | Frontend               |
| ---------- | --------------------------- | ---------------------- |
| Local      | `npm run db:start` (Docker) | `npm run dev`          |
| Staging    | proyecto Supabase aparte    | Vercel *Preview*       |
| Producción | proyecto Supabase principal | Vercel *Production*    |

Las migraciones nuevas se prueban primero en local (`npm run db:reset && npm run db:test &&
npm run test:e2e`), luego en staging y por último en producción con `npx supabase db push`.

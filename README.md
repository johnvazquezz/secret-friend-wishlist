# Secret Friend Wishlist

Aplicación web para organizar el **Amigo Secreto** de la empresa. Está en evolución: hoy muestra las tarjetas de deseos del equipo; el roadmap incluye login, sorteo, wishlist, chat privado y panel de administración.

## 🧩 Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Datos/estado:** React Router, TanStack Query, Zod
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Calidad:** ESLint, Prettier, Vitest + Testing Library, GitHub Actions
- **Despliegue:** Vercel (`vercel.json` con rewrite SPA y cabeceras de seguridad)

## 📁 Estructura

```
src/
  app/            App, rutas, layout, páginas de error/404
  components/ui/  Componentes reutilizables (Button, Modal, Spinner, EmptyState, ErrorState)
  features/       Un módulo por funcionalidad (api.ts, hooks.ts, componentes, tests)
  lib/            Cliente Supabase, tipos de BD, validación de entorno, errores
supabase/
  migrations/     Migraciones SQL versionadas
  seed.sql        Datos de ejemplo para desarrollo local
```

## 💻 Requisitos

- Node.js 20 o superior
- Docker Desktop (solo para levantar Supabase en local)

## 🚀 Cómo empezar

```bash
npm install
cp .env.template .env      # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

### Supabase local

Con Docker Desktop abierto:

```bash
npm run db:start   # levanta Supabase (incluye Edge Functions) e imprime URL y claves
npm run db:reset   # aplica migraciones + seed.sql
npm run db:test    # pruebas de seguridad de la base de datos (pgTAP)
npm run db:types   # regenera src/lib/database.types.ts
```

Para apuntar la app a Supabase local crea `.env.local` con la URL `http://127.0.0.1:54321` y la
`ANON_KEY` que imprime `db:start`.

Usuarios de prueba del seed (contraseña `Amigo2026local`):

| Email              | Rol          | Nota                                    |
| ------------------ | ------------ | --------------------------------------- |
| `admin@local.test` | admin        |                                         |
| `ana@local.test`   | participante |                                         |
| `luis@local.test`  | participante | tiene contraseña temporal (debe cambiarla) |

## 🔐 Cuentas y acceso

- No hay registro público: el **admin crea las cuentas** desde *Usuarios* (una a una o pegando una
  lista `Nombre; email; Departamento`). La app genera una contraseña temporal que se muestra una sola
  vez; el admin la entrega en persona o por Teams.
- En el primer acceso cada persona debe cambiar su contraseña (mín. 10 caracteres, letras y números).
- Si alguien la olvida, el admin usa *Restablecer contraseña*.
- Cada persona puede subir su foto en *Mi perfil*; el admin también puede subirla por ella.
- La seguridad real está en la base de datos (RLS + privilegios por columna) y en la Edge Function
  `admin-users`, la única que usa la service role key.

## 🎁 Evento y sorteo

1. El admin crea el evento en *Evento* (fechas, presupuesto, lugar, reglas). Queda en **borrador**.
2. Agrega participantes (todos los usuarios activos o uno a uno) y, si hace falta, **exclusiones**
   (parejas que no pueden tocarse entre sí).
3. **Abre la inscripción**: cada participante confirma si participa desde *Inicio*. El admin también
   puede marcar la respuesta de quien no entre a la app.
4. **Hace el sorteo**: solo entran los confirmados con cuenta activa. Es un único ciclo aleatorio
   (nadie se regala a sí mismo, todos dan y reciben exactamente un regalo, sin parejas A↔B).
   Mientras no se publique se puede repetir.
5. **Publica**: cada persona ve en *Inicio* a quién le regala (oculto hasta pulsar *Mostrar*).
   Es definitivo.
6. Tras el intercambio, **finaliza** el evento para archivarlo y poder crear el del año siguiente.

### 🔒 Privacidad del sorteo

- **Nadie puede ver quién le regala a quién, tampoco los administradores.** La tabla
  `assignments` no tiene ningún permiso de lectura para los usuarios de la app; cada persona obtiene
  solo su destinatario mediante la función `get_my_assignment`. El admin solo ve conteos.
- No existe ninguna función para revelar al amigo secreto.
- **Lista de deseos** (*Mi lista*): la ve todo el equipo en *Deseos*, así nadie sabe quién te
  regala. **Gustos personales** (tallas, alergias, lo que no te gusta): solo los ve la persona que
  te regala, y solo después de publicar el sorteo.
- Quien tenga acceso al **dashboard de Supabase** (dueño del proyecto) sí podría consultar la base
  de datos directamente. Limita ese acceso a la persona técnica responsable y, si es posible, que no
  sea participante.

## ☁️ Puesta en producción (Supabase)

1. Enlaza el proyecto: `npx supabase link --project-ref <ref>`.
2. Aplica migraciones: `npx supabase db push`.
3. Despliega la función: `npx supabase functions deploy admin-users`.
4. En el dashboard → *Authentication → Sign In / Providers*: desactiva **Allow new users to sign up**,
   deja **Email** habilitado, longitud mínima de contraseña **10** y requisito **letras y dígitos**.
5. Crea el primer admin: *Authentication → Users → Add user* (marca *Auto Confirm*) y luego en el
   *SQL Editor*:

   ```sql
   update public.profiles
   set role = 'admin', must_change_password = false
   where email = 'tu-email@empresa.com';
   ```

6. En Vercel configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto.

## ✅ Scripts

| Script                   | Qué hace                                         |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Servidor de desarrollo                           |
| `npm run build`          | Build de producción                              |
| `npm test`               | Tests (Vitest)                                   |
| `npm run check`          | Formato + tipos + lint + tests (lo mismo que CI) |
| `npm run format`         | Formatea el código con Prettier                  |
| `npm run db:test`        | Pruebas pgTAP de RLS y permisos                  |

## 🔄 Workflow

1. Crea una rama desde `main` (`feat/...`, `fix/...`).
2. Antes de abrir el PR ejecuta `npm run check`.
3. Abre un Pull Request hacia `main`; la CI debe pasar y el PR estar aprobado antes del merge.

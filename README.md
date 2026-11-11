# Secret Friend Wishlist

Aplicación web para organizar el **Amigo Secreto** de la empresa (30–100 personas): cuentas creadas
por el organizador, sorteo **totalmente privado**, listas de deseos, gustos personales, chat
anónimo en tiempo real, notificaciones y panel de administración.

📚 **Documentación:** [Despliegue](docs/DESPLIEGUE.md) · [Guía del organizador](docs/GUIA-ORGANIZADOR.md) · [Seguridad y privacidad](docs/SEGURIDAD.md) · [Pruebas E2E](e2e/README.md)

## 🧩 Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Datos/estado:** React Router 7, TanStack Query, Zod 4
- **Backend:** Supabase (PostgreSQL + RLS, Auth, Storage, Realtime, Edge Functions, pg_cron)
- **Calidad:** ESLint, Prettier, Vitest + Testing Library, pgTAP, E2E con Supabase real, GitHub Actions
- **Despliegue:** Vercel (`vercel.json` con rewrite SPA y cabeceras de seguridad)

## 📁 Estructura

```
src/
  app/            App, rutas, layout, páginas de error/404
  components/ui/  Componentes reutilizables (Button, Modal, Spinner, EmptyState, ErrorState)
  features/       Un módulo por funcionalidad (api.ts, hooks.ts, componentes, tests)
  lib/            Cliente Supabase, tipos de BD, validación de entorno, errores
supabase/
  migrations/     Migraciones SQL versionadas (esquema, RLS, funciones)
  functions/      Edge Function admin-users (única que usa la service role)
  tests/database/ Pruebas pgTAP de seguridad y del sorteo
  seed.sql        Datos de ejemplo para desarrollo local
e2e/              Pruebas de extremo a extremo (API y navegador)
docs/             Despliegue, guía del organizador y seguridad
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

## 💬 Chat

Con el sorteo publicado, en *Mensajes* cada participante puede escribir **a cualquier otro
participante**, con su nombre o **en secreto**, para despistar:

- Quien recibe un chat anónimo ve un alias festivo y no sabe quién es. El chat con su amigo secreto
  real es **indistinguible** de los de despiste, también a nivel de API.
- Quien regala ve a su destinatario marcado como *Tu amigo secreto*, y él no sabe que es ella.
- Se puede **silenciar** cualquier chat. Límite: 10 chats nuevos al día por persona.

Nadie más, tampoco el admin, puede leer las conversaciones ni saber quién escribe en secreto. Los mensajes llegan en tiempo real
(Supabase Realtime, que aplica la misma RLS) y hay un aviso de no leídos en la navegación. Límite
anti-spam: 20 mensajes por minuto. Al finalizar el evento el chat queda en solo lectura.

## 🔔 Notificaciones

Campana en la cabecera, actualizada en tiempo real. Las genera la base de datos:

- **Inscripción abierta** (y a quien se añade después).
- **Sorteo publicado**: "¡Ya puedes ver a quién le regalas!".
- **Recordatorios diarios** (pg_cron, 14:00 UTC): confirmar antes de la fecha límite, lista de
  deseos vacía y cuenta atrás de los 3 últimos días antes del intercambio. Nunca se duplican.
- **Avisos del organizador** desde *Evento › Enviar un aviso* (a todos los usuarios activos).

Los mensajes del chat no generan notificaciones: tienen su propio contador en *Mensajes*.

## ☁️ Puesta en producción

Paso a paso en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) (Supabase, primer admin, Vercel y
comprobación final).

## ✅ Scripts

| Script                   | Qué hace                                         |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Servidor de desarrollo                           |
| `npm run build`          | Build de producción                              |
| `npm test`               | Tests (Vitest)                                   |
| `npm run check`          | Formato + tipos + lint + tests (lo mismo que CI) |
| `npm run format`         | Formatea el código con Prettier                  |
| `npm run db:test`        | Pruebas pgTAP de RLS, permisos y sorteo          |
| `npm run test:e2e`       | E2E contra Supabase local (API, Auth, Realtime)  |
| `npm run test:e2e:ui`    | E2E en el navegador (con `npm run dev` en marcha) |

## 🔄 Workflow

1. Crea una rama desde `main` (`feat/...`, `fix/...`).
2. Antes de abrir el PR ejecuta `npm run check`.
3. Abre un Pull Request hacia `main`; la CI debe pasar y el PR estar aprobado antes del merge.

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

### Supabase local (opcional)

```bash
npm run db:start   # levanta Supabase en Docker e imprime URL y anon key para tu .env
npm run db:reset   # aplica migraciones + seed.sql
npm run db:types   # regenera src/lib/database.types.ts
```

## ✅ Scripts

| Script                   | Qué hace                                         |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Servidor de desarrollo                           |
| `npm run build`          | Build de producción                              |
| `npm test`               | Tests (Vitest)                                   |
| `npm run check`          | Formato + tipos + lint + tests (lo mismo que CI) |
| `npm run format`         | Formatea el código con Prettier                  |

## 🔄 Workflow

1. Crea una rama desde `main` (`feat/...`, `fix/...`).
2. Antes de abrir el PR ejecuta `npm run check`.
3. Abre un Pull Request hacia `main`; la CI debe pasar y el PR estar aprobado antes del merge.

# Pruebas E2E

Se ejecutan contra **Supabase local** (Docker) y comprueban el sistema completo: base de datos,
RLS, Auth, Edge Functions y Realtime. Cada prueba parte de una base de datos recién reiniciada con
`supabase/seed.sql`.

```bash
npm run db:start      # una vez
npm run test:e2e      # pruebas de API
```

| Prueba | Qué comprueba |
| --- | --- |
| `api/01-cuentas-y-permisos` | registro público cerrado, alta de usuarios por el admin, contraseña temporal, fotos, desactivar cuentas |
| `api/02-evento-y-sorteo` | ciclo del evento, exclusiones, sorteo válido y **nadie (ni el admin) puede ver las parejas** |
| `api/03-wishlist-y-gustos` | listas de deseos y que los gustos solo los vea quien regala |
| `api/04-chat-tiempo-real` | chat anónimo por Realtime: llega al destinatario y **no** a terceros ni al admin |

## En el navegador

Con la app en marcha (`npm run dev`), usan Edge o Chrome ya instalados (sin descargar navegadores):

```bash
npm run test:e2e:ui
# Variables opcionales:
#   APP_URL=http://localhost:5173   E2E_BROWSER_CHANNEL=msedge|chrome   E2E_SCREENSHOTS=<carpeta>
```

| Prueba | Qué comprueba |
| --- | --- |
| `ui/01-chat` | dos sesiones: el mensaje y el aviso de no leídos llegan sin recargar y el nombre de quien regala nunca aparece |
| `ui/02-notificaciones` | al publicar el sorteo la campana y la página del participante se actualizan solas; avisos del organizador |

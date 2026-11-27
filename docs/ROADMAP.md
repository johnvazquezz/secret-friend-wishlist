# Roadmap

Orden de implementación de lo decidido en [PRODUCTO.md](PRODUCTO.md). Cada fase se divide en PR
chicos. Cada PR:

1. Se prueba en el entorno local (`npm run local:up` → http://localhost:8080).
2. Pasa `npm run check` y `npm run db:test` (y `test:e2e` si toca chat o Realtime).
3. Se fusiona y despliega **solo con la aprobación del dueño del producto**. Si trae migraciones,
   se aplican en producción antes de fusionar.

Estado: ⬜ pendiente · 🟨 en curso · ✅ hecho

## Ya disponible

- ✅ Sorteo (automático y con papelitos), exclusiones, wishlist por ítems y gustos.
- ✅ Chat secreto anónimo y chats libres (con nombre o en secreto), silenciar.
- ✅ Campana de notificaciones, avisos del organizador, recordatorios diarios.
- ✅ Notificaciones push reales (Web Push, Android e iPhone con la app instalada).
- ✅ Entorno de pruebas local en Docker.

## Fase 0 — Fundaciones

Todo lo demás depende de esto.

| | Feature | Notas |
| --- | --- | --- |
| ⬜ | Varios eventos a la vez (B1) | Quitar `events_single_active_idx`; las RPC y pantallas reciben el evento; migrar el evento actual |
| ⬜ | Organizador y co-organizadores por evento (B1, B2) | Rol por evento, separado del admin global; cualquier empleado crea eventos |
| ⬜ | Invitación por enlace o código (B1) | Solo cuentas de la empresa; desactivable |
| ⬜ | Etapas mixtas (B1) | Cierre automático de inscripción (pg_cron) + recordatorios de cada paso |
| ⬜ | Personalización y módulos activables (B2) | Emoji, color, portada, qué módulos usa cada evento |
| ⬜ | Navegación nueva + modo oscuro (I) | Global + dentro del evento; inicio con panel de actividad |
| ⬜ | Base de fotos (A3) | Bucket privado, compresión y borrado de metadatos en el navegador, límites |
| ⬜ | Registro de actividad | Base para XP, rankings, Wrapped e Inicio |
| ⬜ | Preferencias de notificación (A4) | Categorías, "No molestar", agrupación cada 2 min, avisos obligatorios |

## Fase 1 — Social

| | Feature | Notas |
| --- | --- | --- |
| ⬜ | Chat general del evento (A1) | Fijados, menciones, responder, encuestas |
| ⬜ | Chats grupales (A2) | Creador administra; silenciar por grupo |
| ⬜ | Imágenes y reacciones en todos los chats (A3) | 6 emojis; sin nombres en chats anónimos |
| ⬜ | Confesionario (A5) | Denuncias (3 ocultan); autor nunca revelado |

## Fase 2 — Muro y wishlist

| | Feature | Notas |
| --- | --- | --- |
| ⬜ | Muro de sorpresas + stories 24 h (C) | Anónimo opcional (se revela al final), comentarios con nombre |
| ⬜ | Dirigir a una persona, álbum personal, destacados (C) | |
| ⬜ | Foto en cada deseo + preguntar en secreto (H) | |

## Fase 3 — Detective

| | Feature | Notas |
| --- | --- | --- |
| ⬜ | Cuestionario de detective (D) | Tipos de pista elegidos por el organizador |
| ⬜ | Pistas del amigo secreto + automáticas (D) | Desbloqueo por retos y calendario |
| ⬜ | Sospechoso con historial (D) | Se resuelve en la revelación |
| ⬜ | Predicciones del grupo y "¿Quién fue?" (D) | |

## Fase 4 — Juegos y gamificación

| | Feature | Notas |
| --- | --- | --- |
| ⬜ | Retos: reto del día + misiones semanales (E, F) | Catálogo + organizador; prueba según el reto |
| ⬜ | Calendario de sorpresas (E) | Plantilla semanal editable |
| ⬜ | Bingo, ¿Cuánto me conoces?, ruleta (E) | |
| ⬜ | Operación sorpresa (E) | |
| ⬜ | XP, niveles, insignias, rankings por categoría, cosméticos (F) | Topes diarios por acción |

## Fase 5 — Final del evento

| | Feature | Notas |
| --- | --- | --- |
| ⬜ | Revelación animada (G) | Primero la tuya, luego la cadena; despistes y sorpresas anónimas incluidos |
| ⬜ | Museo con retención (G) | Chats borrados 30 días después del cierre |
| ⬜ | Wrapped (G) | Diapositivas + imagen para compartir |

## Fuera del plan por ahora

Regalos colaborativos · sugerencias de regalo (con o sin IA) · enlaces y precios en la wishlist ·
GIFs y notas de voz · videos en el muro · eventos públicos y registro abierto.

# Modelo de seguridad y privacidad

Principio: **el frontend no protege nada**. Toda regla vive en PostgreSQL (RLS, privilegios por
columna y funciones `SECURITY DEFINER` acotadas) o en la Edge Function `admin-users`. La app solo
usa la clave pública (anon); la `service_role` solo existe en la Edge Function.

## Qué ve cada quién

| Dato | Participante | Admin | Anónimo |
| --- | --- | --- | --- |
| Perfiles (nombre, departamento, foto) | todos | todos | — |
| Rol, estado de cuenta | todos (lectura) | cambia vía Edge Function | — |
| Evento en borrador | — | sí | — |
| Lista de participantes y su respuesta | sí | sí | — |
| Exclusiones | — | sí | — |
| **Asignaciones (quién regala a quién)** | **solo su destinatario, tras publicar** | **no** | — |
| Lista de deseos | todas | todas | — |
| Gustos (tallas, alergias…) | los propios + los de su destinatario tras publicar | **no** | — |
| Mensajes | solo sus dos conversaciones | **no** | — |
| Notificaciones | las propias | las propias | — |
| Registro de auditoría | — | sí | — |
| Estadísticas | — | solo conteos agregados | — |

## Cómo se garantiza

- `assignments` no tiene **ningún** privilegio para `anon`/`authenticated`. Solo se accede por
  `get_my_assignment()` (mi destinatario), `get_my_threads()` y funciones del sorteo que devuelven
  conteos.
- `messages` no tiene columnas de identidad: solo `thread_id` (id opaco) y `author_role`. Realtime
  aplica la misma RLS: un tercero o el admin suscritos a un hilo no reciben nada (probado en
  `e2e/api/04-chat-tiempo-real`).
- Privilegios por columna: un usuario solo puede actualizar `full_name`, `department` y
  `avatar_path` de su perfil; nunca `role`, `is_active`, `email` ni `must_change_password`.
- Sorteo: función única, con bloqueo `FOR UPDATE`, aleatoriedad criptográfica
  (`gen_random_uuid`), no repetible tras publicar y registrada en auditoría.
- Sorteo con papelitos: cada participante registra a su destinatario con `claim_recipient()`. La
  base de datos impide repetir destinatario o registrarse a uno mismo; si la persona ya está
  registrada solo se responde "ya está registrada", nunca por quién. El admin solo ve conteos y,
  para corregir errores, puede liberar a un destinatario sin conocer al giver (la auditoría guarda
  solo el destinatario). Límite aceptado: alguien puede averiguar que a una persona "ya la tiene
  alguien", lo que no revela quién.
- Storage: bucket privado; cada usuario solo escribe en `avatars/{su id}/`; se sirve con URLs
  firmadas de 1 h.
- Enlaces: la lista de deseos no admite enlaces; las notificaciones solo enlazan a rutas internas
  (`/x`, nunca `//dominio`).
- Edge Function: verifica JWT y rol admin en cada petición, valida con Zod, limita el cuerpo a
  64 KB y audita cada acción.
- Límites: 20 deseos por persona, 20 mensajes por minuto por conversación.
- Cabeceras: CSP estricta, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.

## Pruebas

- `supabase/tests/database/*.test.sql` (pgTAP, 138 pruebas): cada regla anterior tiene pruebas
  que intentan saltársela (anónimo, otro participante, admin) y esperan el fallo, más 300 sorteos
  aleatorios verificados.
- `e2e/`: flujos completos contra Supabase real, incluido Realtime.

## Límites conocidos (riesgos aceptados)

- **El dueño del proyecto de Supabase** (acceso al dashboard o a la `service_role`) puede consultar
  la base de datos directamente. Limita ese acceso a una persona técnica que, idealmente, no
  participe.
- Si alguien escribe su nombre en el chat, se revela. La app avisa, pero no lee los mensajes.
- Contraseñas temporales: se entregan fuera de la app; caducan en cuanto la persona las cambia.
- Retención: los mensajes y gustos se conservan tras finalizar el evento. Si la política de la
  empresa lo exige, añade una tarea que los borre N días después de `finished`.

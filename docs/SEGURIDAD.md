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
| Mensajes | solo sus conversaciones | **no** | — |
| **Quién escribe en secreto** (chat libre) | **nadie** (ve un alias) | **no** | — |
| Notificaciones | las propias | las propias | — |
| Registro de auditoría | — | sí | — |
| Estadísticas | — | solo conteos agregados | — |

## Cómo se garantiza

- `assignments` no tiene **ningún** privilegio para `anon`/`authenticated`. Solo se accede por
  `get_my_assignment()` (mi destinatario), `get_my_conversations()` y funciones del sorteo que
  devuelven conteos.
- `messages` no tiene columnas de identidad: solo `thread_id` (id opaco) y `author_role`. Realtime
  aplica la misma RLS: un tercero o el admin suscritos a un hilo no reciben nada (probado en
  `e2e/api/04-chat-tiempo-real`).
- Chat libre: cualquier participante confirmado puede escribir a otro, con su nombre o en
  secreto. `free_threads` y `thread_blocks` tampoco tienen privilegios: solo se usan mediante
  `start_conversation()`, `send_thread_message()`, `set_thread_blocked()` y
  `get_my_conversations()`.
- **Indistinguibles**: para quien recibe, el chat de su amigo secreto real y cualquier chat anónimo
  de despiste devuelven exactamente la misma forma (sin nombre ni foto, alias calculado con la misma
  función `chat_alias()`), comparten tabla, RLS y Realtime, y el del sorteo no aparece hasta que
  tiene mensajes. Ni mirando la red se puede saber cuál es el oficial (probado en
  `08_free_chat` y `e2e/api/04-chat-tiempo-real`).
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
- Límites: 20 deseos por persona, 20 mensajes por minuto por conversación, 10 chats nuevos por
  persona al día. Quien recibe puede **silenciar** un chat: nadie puede volver a escribir en él y no
  se revela ninguna identidad.
- Cabeceras: CSP estricta, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.

## Pruebas

- `supabase/tests/database/*.test.sql` (pgTAP, 169 pruebas): cada regla anterior tiene pruebas
  que intentan saltársela (anónimo, otro participante, admin) y esperan el fallo, más 300 sorteos
  aleatorios verificados.
- `e2e/`: flujos completos contra Supabase real, incluido Realtime.

## Límites conocidos (riesgos aceptados)

- **El dueño del proyecto de Supabase** (acceso al dashboard o a la `service_role`) puede consultar
  la base de datos directamente. Limita ese acceso a una persona técnica que, idealmente, no
  participe.
- Si alguien escribe su nombre en el chat, se revela. La app avisa, pero no lee los mensajes.
- Mensajes anónimos ofensivos: como nadie (tampoco el admin) puede saber quién escribe, la única
  medida es **silenciar** el chat. Es una decisión consciente para mantener el anonimato.
- Sorteo con papelitos: si el admin libera a un destinatario que ya tenía mensajes, esa
  conversación desaparece para quien la recibía, lo que le indica que era la de su amigo secreto.
- Contraseñas temporales: se entregan fuera de la app; caducan en cuanto la persona las cambia.
- Retención: los mensajes y gustos se conservan tras finalizar el evento. Si la política de la
  empresa lo exige, añade una tarea que los borre N días después de `finished`.

# Producto: visión y decisiones por feature

Documento vivo con la dirección del producto y lo decidido para cada feature **antes** de
programarla. El orden de implementación y el estado están en [ROADMAP.md](ROADMAP.md).

Origen: una lluvia de ideas con Gemini y ChatGPT (noviembre 2026), debatida punto por punto con el
dueño del producto el 26/11/2026.

## Visión

Pasar de "una app para hacer el sorteo" a **una experiencia social y gamificada para vivir el
Amigo Secreto antes, durante y después del intercambio**, sin depender de WhatsApp:

- **Conectar**: chats privados, grupales y general.
- **Compartir**: fotos, sorpresas, stories y recuerdos.
- **Jugar**: retos, pistas, detective y minijuegos.
- **Recordar**: Museo de cada edición y Wrapped.

### Principios

1. **Diversión primero**: cada feature aporta entretenimiento o utilidad.
2. **Sencillo**: nada complicado de usar; móvil primero, buena versión de escritorio.
3. **Siempre hay algo que hacer**: motivos para entrar aunque no haya mensajes nuevos.
4. **Privacidad por diseño**: mientras el evento dura, nadie (ni los admins) ve quién regala a
   quién. Todo se decide en la base de datos (RLS + RPC), nunca en el frontend.
5. **Recuerdos permanentes**: cada edición deja algo que valga la pena conservar.
6. **Gamificación con sentido**: los puntos premian interacciones reales, no repetir acciones.

### Decisiones generales

| Tema | Decisión |
| --- | --- |
| Identidad | Híbrido: red social + juegos + Amigo Secreto tradicional |
| Audiencia | **Solo la empresa** (cuentas creadas por admins, sin registro público ni eventos públicos), pero con **varios eventos a la vez** |
| Revelación | **Sí, al final**: cuando el organizador cierra el evento se revela todo. Antes, privacidad absoluta como hoy |
| Estilo | Se conserva la identidad visual actual; se mejora la navegación y se añade modo oscuro |
| Stack | Se mantiene Vite + React + TypeScript + Tailwind + Supabase |
| Forma de trabajo | Cada feature se prueba en el entorno local (`npm run local:up`) y se pregunta antes de fusionar o desplegar |

## A. Social

### A1. Chat general del evento
- Sala de todos los participantes confirmados, **siempre con nombre**.
- Abierto desde que se abre la inscripción; en solo lectura al finalizar.
- Extras: **mensajes fijados** por el organizador, **menciones @**, **responder a un mensaje** y **encuestas**.
- Avisos (campana + push) **solo por menciones y mensajes fijados**; el resto suma al contador de no leídos.
- Aparece como conversación fija "Sala general" arriba en *Mensajes*.
- Moderación: cada quien borra lo suyo; el organizador borra cualquier mensaje ("Mensaje eliminado").
- Tablas propias, separadas de los chats secretos, por evento.

### A2. Chats grupales
- Cualquier participante crea grupos (con límite diario anti-spam).
- Solo el creador invita, quita y renombra. Los miembros pueden salir; si el creador sale, otro
  miembro pasa a administrar.
- **Siempre con nombre** (no hay grupos anónimos).
- Aviso por cada mensaje, agrupado por grupo; cada grupo se puede silenciar.
- Reutiliza los extras del chat general (menciones, respuestas, encuestas).

### A3. Imágenes y reacciones
- Fotos en **todos los chats** (secreto, libres, general y grupos). Se recomprimen en el navegador y
  se les quitan los metadatos (ubicación, modelo del celular) para no delatar a nadie.
- Reacciones: **6 emojis fijos** ❤️ 😂 😮 🎁 🎄 👍.
- Se ve quién reaccionó, **salvo en chats anónimos** (solo la reacción).
- Solo imágenes: sin GIFs (evita servicios externos) ni notas de voz (delatan la identidad).

### A4. Preferencias de notificaciones
- Interruptores de **push por categoría** en *Mi perfil*; la campana siempre muestra todo.
- **No molestar** configurable (por defecto de 22:00 a 08:00): los push se guardan en la campana.
- Como mucho **1 push cada 2 minutos por chat**; los siguientes se resumen ("3 mensajes nuevos").
- Los avisos del organizador y la revelación final **siempre llegan** (respetan "No molestar").

### A5. Confesionario
- Publicaciones anónimas: confesiones divertidas, teorías, agradecimientos.
- Se publican al momento. Con **3 denuncias** se ocultan hasta que el organizador decide; el
  organizador puede borrar.
- El autor **nunca** se revela: ni a los admins ni en la revelación final.
- Solo reacciones (sin comentarios). Límite: **3 publicaciones por persona y día**.

## B. Eventos

### B1. Varios eventos, invitaciones y etapas
- **Cualquier empleado** puede crear un evento y queda como su organizador. Los admins globales
  gestionan cuentas y pueden moderar, pero nunca ven asignaciones.
- Para entrar: el organizador elige personas de la lista de la empresa, o comparte un **enlace o
  código** (solo cuentas de la empresa, desactivable).
- Etapas **mixtas**: la inscripción se cierra sola en la fecha límite y el sistema recuerda cada
  paso; el sorteo, la publicación y la revelación las confirma el organizador.

### B2. Roles y personalización
- Hasta **3 co-organizadores** con los mismos permisos (moderar, fijar, avanzar etapas).
- El organizador **puede participar** en su propio sorteo (solo ve a su destinatario).
- Personalización: **emoji y color** de acento (de la paleta actual), **imagen de portada** y
  **módulos activables** (chat general, confesionario, juegos, detective, stories…).

## C. Stories y muro de sorpresas
- **Muro de sorpresas** permanente y **stories de 24 h** (círculos arriba).
- Se publica con nombre o como "Alguien 🎭". Los autores anónimos **se revelan al final**, lo que
  alimenta el juego de adivinar.
- Reacciones y **comentarios con nombre**.
- Extras: **dirigir una publicación a una persona** ("Para Ana 🎁", visible para todos, Ana recibe
  aviso), **álbum personal** (sorpresas recibidas y publicadas) y **destacados para el Wrapped**.
- Solo fotos (sin videos). Moderación como en el confesionario.

## D. Detective
- Pistas de **dos fuentes**: las que envía tu amigo secreto (pueden ser verdaderas o falsas) y
  **pistas automáticas verdaderas** (marcadas como verificadas), generadas a partir de un
  cuestionario corto de cada participante (mascota, color, hobby, departamento…).
- Las automáticas se desbloquean con **retos** y en fechas que programa el organizador. El
  organizador elige qué tipos de pista se permiten, para que no delaten a nadie en eventos chicos.
- **Sospechoso**: se puede cambiar cuando quieras; se guarda el historial para el Wrapped. Nadie
  sabe si acierta hasta la revelación.
- Extras: **predicciones del grupo** (apuestas simbólicas de quién regala a quién), **"¿Quién
  fue?"** (votar el autor de sorpresas anónimas del muro) y **ranking de detectives** al final.

## E. Juegos
- Los cuatro: **reto del día**, **bingo**, **¿Cuánto me conoces?** (trivia a partir del cuestionario
  y la wishlist) y **ruleta de desafíos**.
- Contenido: **catálogo propio** (en español, festivo) + lo que agregue o quite el organizador.
- Cómo se cumple un reto: los de foto, publicando en el muro; las acciones dentro de la app se
  detectan solas; el resto, con un botón "Hecho" a palabra.
- **Operación sorpresa**: misión secreta para otra persona (dejarle un café, una nota); al
  completarla, la persona recibe un aviso misterioso. Puede pedir foto y da puntos.
- **Calendario de sorpresas**: al crear el evento se propone una semana tipo (de la publicación al
  intercambio) que el organizador ajusta día por día.
- **Bingo**: cada jugador tiene un cartón distinto y marca a palabra; gana la primera línea o el
  cartón completo.

## F. Gamificación
- **XP, niveles e insignias** (Detective, Generoso, Social, Constante, Campeón, Sospechoso…).
- XP y rankings **por evento** (todos empiezan igual) y **nivel e insignias acumulados** en el
  perfil a lo largo de los años.
- Rankings **solo por categorías divertidas** (sin tabla general): mejor detective, rey de las
  pistas falsas, más creativo, espíritu navideño…
- Recompensas **solo cosméticas**: marcos de avatar, temas de perfil y retos extra. Nunca ventajas
  para descubrir al amigo secreto.
- "Reto del día" y misiones unificados en una sección **Retos**: el reto del día para todos más
  2–3 misiones personales por semana.
- **Topes diarios de XP** por acción (por ejemplo, reacciones solo las primeras 5 al día); los retos
  y las sorpresas valen más. Los valores se ajustan después del primer evento.

## G. Final del evento
- Al pulsar **Revelar**, cada persona abre primero una animación con **su** amigo secreto (y si su
  sospechoso acertó). Después se desbloquea la **cadena completa** de quién regaló a quién.
- También se revelan los autores de los **chats anónimos de despiste** y de las sorpresas anónimas
  del muro. El confesionario nunca.
- **Museo**: se conservan el muro, los destacados, la revelación, las estadísticas y el Wrapped.
  Los chats privados y de grupo se **borran 30 días después** de cerrar el evento (con aviso).
- **Wrapped**: diapositivas animadas en la app (estilo Spotify Wrapped), con una versión para
  compartir como imagen.

## H. Wishlist
- **Foto en cada deseo**.
- **Preguntar en secreto sobre un deseo**: botón en la wishlist de tu amigo secreto que abre el chat
  anónimo citando ese deseo.
- Descartado por ahora: regalos colaborativos, sugerencias de regalo (con o sin IA), volver a
  permitir enlaces y precios.

## I. Navegación y UX
- **Navegación global**: Inicio (actividad de todos tus eventos), Eventos, Actividad
  (notificaciones) y Perfil.
- **Dentro de un evento**, barra inferior en el celular: Inicio · Chats · Muro · Juegos · Más
  (Detective, Mi amigo secreto y Wishlist, Confesionario, Recuerdos).
- **Inicio del evento**: panel de actividad con tu amigo secreto, el reto del día, pistas nuevas,
  las últimas sorpresas, la cuenta atrás del intercambio y tu progreso.
- **Modo oscuro** automático (según el celular) con interruptor en el perfil.

## Cómo mediremos si funciona
- Proporción de participantes activos durante el evento y frecuencia semanal (indicador principal).
- Uso de chats, fotos y sorpresas publicadas, retos completados y cuántos llegan a la revelación.
- Sin inflar números con notificaciones excesivas ni puntos fáciles.

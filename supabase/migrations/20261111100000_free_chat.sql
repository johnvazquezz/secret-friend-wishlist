-- Chat libre: cualquier participante puede escribir a otro, con su nombre o EN SECRETO.
--
-- Objetivo del juego: despistar. Quien recibe un chat anónimo ve un alias festivo
-- ("Reno misterioso 🦌") y NO puede saber si es su amigo secreto de verdad o cualquier otra
-- persona. Para que eso sea cierto también a nivel de API:
--   * el hilo del sorteo (assignments) y los hilos libres (free_threads) comparten la tabla
--     messages, la misma RLS, Realtime y las mismas RPC;
--   * del lado de quien recibe, un hilo del sorteo y uno libre anónimo devuelven filas idénticas
--     (sin nombre ni avatar, alias calculado con la misma función);
--   * el hilo del sorteo del lado receptor no aparece hasta que tiene mensajes (si no, un chat
--     anónimo vacío desde el primer día delataría cuál es el oficial).
-- Nadie (tampoco el admin) puede leer free_threads ni thread_blocks: solo RPC SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.free_threads (
  thread_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  initiator_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  initiator_anonymous boolean not null,
  created_at timestamptz not null default now(),
  constraint free_threads_not_self check (initiator_id <> recipient_id),
  constraint free_threads_unique unique (event_id, initiator_id, recipient_id, initiator_anonymous)
);

create index free_threads_initiator_idx on public.free_threads (event_id, initiator_id);
create index free_threads_recipient_idx on public.free_threads (event_id, recipient_id);

alter table public.free_threads enable row level security;
revoke all on table public.free_threads from anon, authenticated;

-- Chats silenciados por cada persona (para sí misma).
create table public.thread_blocks (
  thread_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.thread_blocks enable row level security;
revoke all on table public.thread_blocks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- messages: el hilo puede ser del sorteo o libre
-- ---------------------------------------------------------------------------
-- Ya no puede ser FK a assignments. La integridad la garantizan las RPC (únicas que insertan) y el
-- borrado en cascada pasa a triggers (reset_draw, liberar un papelito, borrar un evento...).
alter table public.messages drop constraint messages_thread_id_fkey;

create function public.delete_thread_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.messages where thread_id = old.thread_id;
  delete from public.thread_blocks where thread_id = old.thread_id;
  return old;
end;
$$;

revoke execute on function public.delete_thread_data() from public, anon, authenticated;

create trigger assignments_delete_thread_data
  after delete on public.assignments
  for each row execute function public.delete_thread_data();

create trigger free_threads_delete_thread_data
  after delete on public.free_threads
  for each row execute function public.delete_thread_data();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Rol del usuario actual en un hilo (del sorteo o libre). En los libres, quien inicia actúa como
-- 'giver' y quien recibe como 'receiver'. Usado por la RLS de messages (y por tanto Realtime).
create or replace function public.my_thread_role(p_thread_id uuid)
returns public.chat_role
language sql
stable
security definer
set search_path = ''
as $$
  select r.thread_role from (
    select case
      when a.giver_id = (select auth.uid()) then 'giver'::public.chat_role
      when a.receiver_id = (select auth.uid()) then 'receiver'::public.chat_role
    end as thread_role
    from public.assignments a
    join public.events e on e.id = a.event_id
    where a.thread_id = p_thread_id
      and e.status in ('published', 'finished')
    union all
    select case
      when f.initiator_id = (select auth.uid()) then 'giver'::public.chat_role
      when f.recipient_id = (select auth.uid()) then 'receiver'::public.chat_role
    end
    from public.free_threads f
    join public.events e on e.id = f.event_id
    where f.thread_id = p_thread_id
      and e.status in ('published', 'finished')
  ) r
  where r.thread_role is not null
  limit 1;
$$;

-- Datos internos de un hilo (evento y la otra persona). Nunca se expone a clientes.
create function public.thread_info(p_thread_id uuid, p_me uuid)
returns table (event_id uuid, event_status public.event_status, partner_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select a.event_id, e.status,
    case when a.giver_id = p_me then a.receiver_id else a.giver_id end
  from public.assignments a
  join public.events e on e.id = a.event_id
  where a.thread_id = p_thread_id and p_me in (a.giver_id, a.receiver_id)
  union all
  select f.event_id, e.status,
    case when f.initiator_id = p_me then f.recipient_id else f.initiator_id end
  from public.free_threads f
  join public.events e on e.id = f.event_id
  where f.thread_id = p_thread_id and p_me in (f.initiator_id, f.recipient_id);
$$;

revoke execute on function public.thread_info(uuid, uuid) from public, anon, authenticated;

-- Alias festivo y estable de un hilo. La MISMA función para hilos del sorteo y libres.
create function public.chat_alias(p_thread_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array[
      'Reno misterioso', 'Duende travieso', 'Copo de nieve', 'Elfo curioso', 'Bastón de caramelo',
      'Calcetín sorpresa', 'Estrella fugaz', 'Muñeco de nieve', 'Turrón secreto', 'Pingüino viajero',
      'Galleta de jengibre', 'Campanita alegre', 'Búho nocturno', 'Zorro astuto', 'Gorro de lana',
      'Lazo dorado', 'Chocolate caliente', 'Trineo veloz', 'Vela encendida', 'Piña navideña',
      'Bufanda roja', 'Ardilla risueña', 'Oso polar', 'Cascanueces', 'Papel de regalo',
      'Polvorón', 'Guirnalda brillante', 'Cometa nevada', 'Mitón perdido', 'Rey del turrón'
    ])[1 + abs(hashtext(p_thread_id::text)::bigint) % 30]
    || ' '
    || (array['🦌', '🎄', '❄️', '⛄', '🎁', '⭐', '🔔', '🍪'])[1 + abs(hashtext('e' || p_thread_id::text)::bigint) % 8];
$$;

revoke execute on function public.chat_alias(uuid) from public, anon, authenticated;

-- ¿Es participante confirmado y activo?
create function public.is_active_participant(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event_id and ep.user_id = p_user_id and ep.status = 'confirmed'
  );
$$;

revoke execute on function public.is_active_participant(uuid, uuid) from public, anon, authenticated;

-- Inserta un mensaje comprobando cierre, bloqueo, contenido y límite anti-spam.
create function public.insert_thread_message(p_thread_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_role public.chat_role := public.my_thread_role(p_thread_id);
  v_info record;
  v_id uuid;
begin
  if v_role is null then
    raise exception 'no_thread' using errcode = 'P0001';
  end if;
  select * into v_info from public.thread_info(p_thread_id, v_me) limit 1;
  if v_info.event_status <> 'published' then
    raise exception 'chat_closed' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.thread_blocks
    where thread_id = p_thread_id and user_id in (v_me, v_info.partner_id)
  ) then
    raise exception 'thread_blocked' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;
  -- Límite anti-spam: 20 mensajes por minuto por persona y conversación.
  if (
    select count(*) from public.messages
    where thread_id = p_thread_id and author_role = v_role
      and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.messages (thread_id, author_role, body)
  values (p_thread_id, v_role, trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.insert_thread_message(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- API del chat
-- ---------------------------------------------------------------------------
-- Todas mis conversaciones del evento, con la misma forma para todas.
--   partner_name / partner_avatar_path: solo si la otra persona escribe con su nombre.
--   partner_alias: alias de la otra persona cuando es anónima para mí.
--   my_alias: mi alias cuando yo soy anónimo para la otra persona.
--   is_my_recipient: solo en el hilo con la persona a la que yo regalo.
create function public.get_my_conversations(p_event_id uuid)
returns table (
  thread_id uuid,
  my_role public.chat_role,
  partner_name text,
  partner_avatar_path text,
  partner_alias text,
  my_alias text,
  is_my_recipient boolean,
  unread integer,
  last_message_at timestamptz,
  blocked_by_me boolean,
  blocked_by_partner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  raw as (
    -- Sorteo: yo regalo (conozco a mi destinatario; él no me conoce)
    select a.thread_id, 'giver'::public.chat_role as my_role, a.receiver_id as partner_id,
      false as partner_hidden, true as me_hidden, true as is_my_recipient
    from public.assignments a, me
    where a.event_id = p_event_id and a.giver_id = me.id
    union all
    -- Sorteo: me regalan (no sé quién)
    select a.thread_id, 'receiver', a.giver_id, true, false, false
    from public.assignments a, me
    where a.event_id = p_event_id and a.receiver_id = me.id
    union all
    -- Libre: lo inicié yo
    select f.thread_id, 'giver', f.recipient_id, false, f.initiator_anonymous, false
    from public.free_threads f, me
    where f.event_id = p_event_id and f.initiator_id = me.id
    union all
    -- Libre: me escribieron
    select f.thread_id, 'receiver', f.initiator_id, f.initiator_anonymous, false, false
    from public.free_threads f, me
    where f.event_id = p_event_id and f.recipient_id = me.id
  ),
  stats as (
    select r.*,
      (select count(*)::integer from public.messages m
        where m.thread_id = r.thread_id and m.author_role <> r.my_role and m.read_at is null) as unread,
      (select max(m.created_at) from public.messages m where m.thread_id = r.thread_id) as last_at
    from raw r
  )
  select
    s.thread_id,
    s.my_role,
    case when s.partner_hidden then null else p.full_name end,
    case when s.partner_hidden then null else p.avatar_path end,
    case when s.partner_hidden then public.chat_alias(s.thread_id) end,
    case when s.me_hidden then public.chat_alias(s.thread_id) end,
    s.is_my_recipient,
    s.unread,
    s.last_at,
    exists (select 1 from public.thread_blocks b, me where b.thread_id = s.thread_id and b.user_id = me.id),
    exists (select 1 from public.thread_blocks b where b.thread_id = s.thread_id and b.user_id = s.partner_id)
  from stats s
  join public.profiles p on p.id = s.partner_id
  where exists (
      select 1 from public.events e
      where e.id = p_event_id and e.status in ('published', 'finished')
    )
    -- Del lado de quien recibe, solo cuando ya hay mensajes (igual para sorteo y libres).
    and (s.my_role = 'giver' or s.last_at is not null)
  order by s.last_at desc nulls last, s.thread_id;
$$;

-- Abre (o reutiliza) un chat con otra persona y envía el primer mensaje. Devuelve el hilo.
create function public.start_conversation(
  p_event_id uuid,
  p_recipient_id uuid,
  p_anonymous boolean,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_thread uuid;
begin
  if not exists (select 1 from public.events where id = p_event_id and status = 'published') then
    raise exception 'chat_closed' using errcode = 'P0001';
  end if;
  if p_recipient_id = v_me then
    raise exception 'cannot_message_self' using errcode = 'P0001';
  end if;
  if not public.is_active_participant(p_event_id, v_me)
    or not public.is_active_participant(p_event_id, p_recipient_id) then
    raise exception 'not_participant' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;

  if p_anonymous then
    select thread_id into v_thread from public.free_threads
    where event_id = p_event_id and initiator_id = v_me and recipient_id = p_recipient_id
      and initiator_anonymous;
  else
    -- Con nombre, la pareja es simétrica: si la otra persona ya abrió uno con su nombre, se usa.
    select thread_id into v_thread from public.free_threads
    where event_id = p_event_id and not initiator_anonymous
      and ((initiator_id = v_me and recipient_id = p_recipient_id)
        or (initiator_id = p_recipient_id and recipient_id = v_me))
    order by created_at
    limit 1;
  end if;

  if v_thread is null then
    if (
      select count(*) from public.free_threads
      where initiator_id = v_me and created_at > now() - interval '1 day'
    ) >= 10 then
      raise exception 'too_many_conversations' using errcode = 'P0001';
    end if;
    insert into public.free_threads (event_id, initiator_id, recipient_id, initiator_anonymous)
    values (p_event_id, v_me, p_recipient_id, p_anonymous)
    returning thread_id into v_thread;
  end if;

  perform public.insert_thread_message(v_thread, p_body);
  return v_thread;
end;
$$;

-- Envía un mensaje en una de mis conversaciones (del sorteo o libre).
create function public.send_thread_message(p_thread_id uuid, p_body text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.insert_thread_message(p_thread_id, p_body);
$$;

-- Silencia (o reactiva) una conversación para mí.
create function public.set_thread_blocked(p_thread_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if public.my_thread_role(p_thread_id) is null then
    raise exception 'no_thread' using errcode = 'P0001';
  end if;
  if p_blocked then
    insert into public.thread_blocks (thread_id, user_id) values (p_thread_id, v_me)
    on conflict do nothing;
  else
    delete from public.thread_blocks where thread_id = p_thread_id and user_id = v_me;
  end if;
end;
$$;

-- El envío antiguo por (evento, rol) queda sustituido: un solo camino de escritura.
drop function public.send_message(uuid, public.chat_role, text);
drop function public.get_my_threads(uuid);
drop function public.my_thread_id(uuid, public.chat_role);

revoke execute on function public.get_my_conversations(uuid) from public, anon;
revoke execute on function public.start_conversation(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.send_thread_message(uuid, text) from public, anon;
revoke execute on function public.set_thread_blocked(uuid, boolean) from public, anon;
grant execute on function public.get_my_conversations(uuid) to authenticated;
grant execute on function public.start_conversation(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.send_thread_message(uuid, text) to authenticated;
grant execute on function public.set_thread_blocked(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Estadísticas del admin: solo totales
-- ---------------------------------------------------------------------------
drop function public.admin_event_stats(uuid);

create function public.admin_event_stats(p_event_id uuid)
returns table (
  invited integer,
  confirmed integer,
  declined integer,
  with_wishlist integer,
  with_preferences integer,
  pending_password integer,
  conversations_started integer,
  messages_total integer,
  free_conversations integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  with p as (
    select ep.user_id, ep.status
    from public.event_participants ep
    where ep.event_id = p_event_id
  ),
  all_threads as (
    select a.thread_id from public.assignments a where a.event_id = p_event_id
    union all
    select f.thread_id from public.free_threads f where f.event_id = p_event_id
  )
  select
    (select count(*) from p where status = 'invited')::integer,
    (select count(*) from p where status = 'confirmed')::integer,
    (select count(*) from p where status = 'declined')::integer,
    (select count(*) from p where status <> 'declined'
       and exists (select 1 from public.wishlist_items w where w.user_id = p.user_id))::integer,
    (select count(*) from p where status <> 'declined'
       and exists (select 1 from public.user_preferences up where up.user_id = p.user_id))::integer,
    (select count(*) from p join public.profiles pr on pr.id = p.user_id
       where pr.must_change_password and pr.is_active)::integer,
    (select count(distinct m.thread_id) from public.messages m
       join public.assignments a on a.thread_id = m.thread_id
       where a.event_id = p_event_id)::integer,
    (select count(*) from public.messages m
       where m.thread_id in (select t.thread_id from all_threads t))::integer,
    (select count(*) from public.free_threads f where f.event_id = p_event_id)::integer;
end;
$$;

revoke execute on function public.admin_event_stats(uuid) from public, anon;
grant execute on function public.admin_event_stats(uuid) to authenticated;

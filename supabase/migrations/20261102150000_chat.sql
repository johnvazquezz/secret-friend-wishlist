-- Fase 5: chat privado y anónimo entre cada persona y su amigo secreto.
--
-- Cada asignación (giver → receiver) es una conversación ("hilo"), identificada por un id OPACO.
--   * El giver sabe con quién habla (su destinatario).
--   * El receiver NO sabe con quién habla: los mensajes no guardan quién los envió, solo el rol
--     ('giver' | 'receiver'), y la tabla assignments sigue siendo ilegible para todos.
--   * Nadie más (tampoco el admin) puede leer la conversación.
--   * Solo se escribe mediante send_message(), que resuelve el hilo a partir de auth.uid().
--   * El chat está abierto solo con el sorteo publicado.

-- Id opaco del hilo: no revela giver ni receiver.
alter table public.assignments add column thread_id uuid not null default gen_random_uuid();
alter table public.assignments add constraint assignments_thread_id_key unique (thread_id);

create type public.chat_role as enum ('giver', 'receiver');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assignments (thread_id) on delete cascade,
  author_role public.chat_role not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_thread_created_idx on public.messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Rol del usuario actual en un hilo ('giver', 'receiver' o null). SECURITY DEFINER: se usa en RLS
-- sin dar acceso a assignments.
create function public.my_thread_role(p_thread_id uuid)
returns public.chat_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when a.giver_id = (select auth.uid()) then 'giver'::public.chat_role
    when a.receiver_id = (select auth.uid()) then 'receiver'::public.chat_role
  end
  from public.assignments a
  join public.events e on e.id = a.event_id
  where a.thread_id = p_thread_id
    and e.status in ('published', 'finished');
$$;

revoke execute on function public.my_thread_role(uuid) from public, anon;
grant execute on function public.my_thread_role(uuid) to authenticated;

-- Hilo del usuario actual en un evento para un rol dado (solo con el sorteo publicado).
create function public.my_thread_id(p_event_id uuid, p_as public.chat_role)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.thread_id
  from public.assignments a
  join public.events e on e.id = a.event_id
  where a.event_id = p_event_id
    and e.status in ('published', 'finished')
    and case p_as
      when 'giver' then a.giver_id = (select auth.uid())
      else a.receiver_id = (select auth.uid())
    end;
$$;

revoke execute on function public.my_thread_id(uuid, public.chat_role) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- API del chat
-- ---------------------------------------------------------------------------
-- Mis dos conversaciones del evento. Del lado "receiver" NUNCA se devuelve nada del giver.
create function public.get_my_threads(p_event_id uuid)
returns table (
  thread_id uuid,
  my_role public.chat_role,
  partner_name text,
  partner_avatar_path text,
  unread integer,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select a.thread_id, 'giver'::public.chat_role as my_role, p.full_name, p.avatar_path
    from public.assignments a
    join public.profiles p on p.id = a.receiver_id
    where a.event_id = p_event_id and a.giver_id = (select auth.uid())
    union all
    select a.thread_id, 'receiver'::public.chat_role, null::text, null::text
    from public.assignments a
    where a.event_id = p_event_id and a.receiver_id = (select auth.uid())
  )
  select
    m.thread_id,
    m.my_role,
    m.full_name,
    m.avatar_path,
    (select count(*)::integer from public.messages msg
      where msg.thread_id = m.thread_id and msg.author_role <> m.my_role and msg.read_at is null),
    (select max(msg.created_at) from public.messages msg where msg.thread_id = m.thread_id)
  from mine m
  where exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status in ('published', 'finished')
  );
$$;

-- Envía un mensaje en mi conversación como 'giver' o como 'receiver'.
create function public.send_message(p_event_id uuid, p_as public.chat_role, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread uuid;
  v_id uuid;
begin
  if not exists (select 1 from public.events where id = p_event_id and status = 'published') then
    raise exception 'chat_closed' using errcode = 'P0001';
  end if;

  v_thread := public.my_thread_id(p_event_id, p_as);
  if v_thread is null then
    raise exception 'no_thread' using errcode = 'P0001';
  end if;

  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;

  -- Límite anti-spam: 20 mensajes por minuto por persona y conversación.
  if (
    select count(*) from public.messages
    where thread_id = v_thread and author_role = p_as and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.messages (thread_id, author_role, body)
  values (v_thread, p_as, trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- Marca como leídos los mensajes recibidos en una de mis conversaciones.
create function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.chat_role := public.my_thread_role(p_thread_id);
begin
  if v_role is null then
    raise exception 'no_thread' using errcode = 'P0001';
  end if;
  update public.messages
  set read_at = now()
  where thread_id = p_thread_id and author_role <> v_role and read_at is null;
end;
$$;

revoke execute on function public.get_my_threads(uuid) from public, anon;
revoke execute on function public.send_message(uuid, public.chat_role, text) from public, anon;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.get_my_threads(uuid) to authenticated;
grant execute on function public.send_message(uuid, public.chat_role, text) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: lectura solo para los dos participantes del hilo (también aplica a Realtime)
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;

create policy "Thread members read messages"
  on public.messages for select to authenticated
  using (public.my_thread_role(thread_id) is not null);

-- Tiempo real para el chat.
alter publication supabase_realtime add table public.messages;

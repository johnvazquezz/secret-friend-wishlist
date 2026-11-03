-- Fase 6: notificaciones dentro de la web.
--
-- Las genera la base de datos (triggers, funciones y una tarea diaria con pg_cron); los clientes
-- solo pueden leer las suyas y marcarlas como leídas. Nunca contienen información del sorteo
-- más allá de "ya puedes ver a quién le regalas".

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 1000),
  -- solo rutas internas de la app: '/x', nunca '//dominio' ni '/<barra invertida>dominio'
  link text check (link is null or (left(link, 1) = '/' and substr(link, 2, 1) not in ('/', chr(92)))),
  dedupe_key text, -- evita duplicar recordatorios
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, dedupe_key)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;

create policy "Users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Helper interno para crear notificaciones (idempotente con dedupe_key)
-- ---------------------------------------------------------------------------
create function public.notify(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_link text default '/',
  p_dedupe_key text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user_id, p_kind, p_title, p_body, p_link, p_dedupe_key)
  on conflict (user_id, dedupe_key) do nothing;
$$;

revoke execute on function public.notify(uuid, text, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- API del usuario
-- ---------------------------------------------------------------------------
create function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid())
    and read_at is null
    and (p_ids is null or id = any (p_ids));
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Aviso del organizador a todos los usuarios activos.
create function public.send_announcement(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.require_admin();
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120
     or char_length(coalesce(p_body, '')) > 1000 then
    raise exception 'invalid_announcement' using errcode = 'P0001';
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'announcement', trim(p_title), nullif(trim(p_body), ''), '/'
  from public.profiles
  where is_active;
  get diagnostics v_count = row_count;

  perform public.write_audit('announcement.send', null, jsonb_build_object('title', p_title, 'recipients', v_count));
  return v_count;
end;
$$;

revoke execute on function public.send_announcement(text, text) from public, anon;
grant execute on function public.send_announcement(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Notificaciones automáticas del ciclo de vida del evento
-- ---------------------------------------------------------------------------
create function public.on_event_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'open' and old.status = 'draft' then
    for r in select user_id from public.event_participants where event_id = new.id loop
      perform public.notify(r.user_id, 'event_open',
        '¡Arrancó el ' || new.name || '!',
        'Confirma si participas y prepara tu lista de deseos.',
        '/', 'event_open:' || new.id);
    end loop;
  elsif new.status = 'published' and old.status = 'drawn' then
    for r in
      select a.giver_id as user_id from public.assignments a where a.event_id = new.id
    loop
      perform public.notify(r.user_id, 'draw_published',
        '¡Ya puedes ver a quién le regalas! 🎁',
        'El sorteo se publicó. Entra para descubrir a tu amigo secreto y ver su lista de deseos.',
        '/', 'draw_published:' || new.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger events_notify_status_change
  after update of status on public.events
  for each row execute function public.on_event_status_change();

-- Quien es añadido a un evento con la inscripción ya abierta también recibe el aviso.
create function public.on_participant_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  select id, name, status into v_event from public.events where id = new.event_id;
  if v_event.status = 'open' then
    perform public.notify(new.user_id, 'event_open',
      '¡Arrancó el ' || v_event.name || '!',
      'Confirma si participas y prepara tu lista de deseos.',
      '/', 'event_open:' || v_event.id);
  end if;
  return new;
end;
$$;

create trigger event_participants_notify_added
  after insert on public.event_participants
  for each row execute function public.on_participant_added();

revoke execute on function public.on_event_status_change() from public, anon, authenticated;
revoke execute on function public.on_participant_added() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recordatorios diarios
-- ---------------------------------------------------------------------------
create function public.send_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_before integer;
  v_after integer;
  r record;
  v_days integer;
begin
  select count(*) into v_before from public.notifications;

  select * into v_event from public.events where status <> 'finished' order by created_at desc limit 1;
  if not found then
    return 0;
  end if;

  -- 1. Fecha límite de inscripción en menos de 48 h y sin responder
  if v_event.status = 'open' and v_event.registration_deadline is not null
     and v_event.registration_deadline between p_now and p_now + interval '48 hours' then
    for r in
      select user_id from public.event_participants where event_id = v_event.id and status = 'invited'
    loop
      perform public.notify(r.user_id, 'reminder_registration',
        'Aún no confirmaste tu participación',
        'La inscripción cierra pronto. ¡Entra y confirma si participas!',
        '/', 'reminder_registration:' || v_event.id);
    end loop;
  end if;

  -- 2. Lista de deseos vacía (participantes confirmados o pendientes)
  if v_event.status in ('open', 'drawn', 'published') then
    for r in
      select ep.user_id from public.event_participants ep
      where ep.event_id = v_event.id and ep.status <> 'declined'
        and not exists (select 1 from public.wishlist_items w where w.user_id = ep.user_id)
    loop
      perform public.notify(r.user_id, 'reminder_wishlist',
        'Tu lista de deseos está vacía',
        'Ayuda a tu amigo secreto: añade algunas ideas de regalo.',
        '/mi-lista', 'reminder_wishlist:' || v_event.id);
    end loop;
  end if;

  -- 3. Intercambio en 3 días o menos
  if v_event.status = 'published' and v_event.exchange_at is not null
     and v_event.exchange_at between p_now and p_now + interval '3 days' then
    v_days := greatest(0, extract(day from (v_event.exchange_at - p_now))::integer);
    for r in select giver_id as user_id from public.assignments where event_id = v_event.id loop
      perform public.notify(r.user_id, 'reminder_exchange',
        case when v_days = 0 then '¡El intercambio es hoy! 🎄'
             else 'Faltan ' || v_days || ' día(s) para el intercambio' end,
        '¿Ya tienes el regalo de tu amigo secreto?',
        '/', 'reminder_exchange:' || v_event.id || ':' || v_days);
    end loop;
  end if;

  select count(*) into v_after from public.notifications;
  return v_after - v_before;
end;
$$;

revoke execute on function public.send_reminders(timestamptz) from public, anon, authenticated;

-- Tarea diaria (14:00 UTC ≈ 9:00 en UTC-5). pg_cron está disponible en Supabase.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('amigo-secreto-reminders', '0 14 * * *', $$select public.send_reminders()$$);

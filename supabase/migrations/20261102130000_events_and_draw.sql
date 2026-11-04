-- Fase 3: evento, participantes, exclusiones y sorteo.
--
-- PRIVACIDAD (decisión de producto): nadie puede ver quién le regala a quién, tampoco los admins.
--   * public.assignments no tiene ningún privilegio para anon/authenticated: ni SELECT.
--   * Cada participante obtiene SOLO su destinatario mediante get_my_assignment().
--   * Las funciones del admin devuelven conteos, nunca parejas.
--   * No existe ninguna función de "revelado".
--
-- Ciclo de vida del evento:
--   draft → open → drawn → published → finished
--   (drawn → open con reset_draw: solo antes de publicar)

-- ---------------------------------------------------------------------------
-- Tipos y tablas
-- ---------------------------------------------------------------------------
create type public.event_status as enum ('draft', 'open', 'drawn', 'published', 'finished');
create type public.participation_status as enum ('invited', 'confirmed', 'declined');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  rules text check (rules is null or char_length(rules) <= 4000),
  budget_amount numeric(10, 2) check (budget_amount is null or budget_amount >= 0),
  currency text not null default 'USD' check (char_length(currency) between 1 and 8),
  location text check (location is null or char_length(location) <= 200),
  registration_deadline timestamptz,
  exchange_at timestamptz,
  status public.event_status not null default 'draft',
  drawn_at timestamptz,
  published_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo puede haber un evento activo (no finalizado) a la vez.
create unique index events_single_active_idx on public.events ((true)) where status <> 'finished';

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_participants (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.participation_status not null default 'invited',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_participants_user_idx on public.event_participants (user_id);

-- Pareja que no puede tocarse entre sí (en ningún sentido). Se guarda ordenada: user_a < user_b.
create table public.exclusions (
  event_id uuid not null references public.events (id) on delete cascade,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_a, user_b),
  check (user_a < user_b)
);

create table public.assignments (
  event_id uuid not null references public.events (id) on delete cascade,
  giver_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, giver_id),
  unique (event_id, receiver_id),
  check (giver_id <> receiver_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- ¿Se pueden modificar participantes/exclusiones? Solo antes del sorteo.
create function public.event_is_editable(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events where id = p_event_id and status in ('draft', 'open')
  );
$$;

revoke execute on function public.event_is_editable(uuid) from public, anon;
grant execute on function public.event_is_editable(uuid) to authenticated;

create function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_admin() from public, anon, authenticated;

-- Bloquea el evento y comprueba su estado. Devuelve el estado actual.
create function public.lock_event(p_event_id uuid, p_expected public.event_status[])
returns public.event_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.event_status;
begin
  select status into v_status from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if not (v_status = any (p_expected)) then
    raise exception 'invalid_event_status' using errcode = 'P0001',
      detail = format('Estado actual: %s', v_status);
  end if;
  return v_status;
end;
$$;

revoke execute on function public.lock_event(uuid, public.event_status[]) from public, anon, authenticated;

create function public.write_audit(p_action text, p_target uuid, p_details jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_id, details)
  values ((select auth.uid()), p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;

revoke execute on function public.write_audit(text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ciclo de vida (solo admin)
-- ---------------------------------------------------------------------------
create function public.open_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['draft']::public.event_status[]);
  update public.events set status = 'open' where id = p_event_id;
  perform public.write_audit('event.open', p_event_id);
end;
$$;

-- Sorteo: un único ciclo aleatorio que respeta las exclusiones.
--   * Cada participante confirmado regala exactamente a uno y recibe de exactamente uno.
--   * Nadie se regala a sí mismo; con un ciclo único tampoco hay parejas recíprocas (A↔B).
--   * Aleatoriedad: orden por gen_random_uuid() (UUID v4, generador criptográfico).
--   * Devuelve solo el número de participantes: nunca las parejas.
create function public.run_draw(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_n integer;
  v_attempt integer;
  v_ok boolean;
  v_i integer;
  v_giver uuid;
  v_receiver uuid;
  v_max_attempts constant integer := 2000;
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['open']::public.event_status[]);

  select count(*) into v_n
  from public.event_participants ep
  join public.profiles p on p.id = ep.user_id and p.is_active
  where ep.event_id = p_event_id and ep.status = 'confirmed';

  if v_n < 3 then
    raise exception 'not_enough_participants' using errcode = 'P0001',
      detail = format('Confirmados: %s (mínimo 3)', v_n);
  end if;

  for v_attempt in 1 .. v_max_attempts loop
    select array_agg(ep.user_id order by gen_random_uuid()) into v_ids
    from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event_id and ep.status = 'confirmed';

    v_ok := true;
    for v_i in 1 .. v_n loop
      v_giver := v_ids[v_i];
      v_receiver := v_ids[(v_i % v_n) + 1];
      if exists (
        select 1 from public.exclusions
        where event_id = p_event_id
          and user_a = least(v_giver, v_receiver)
          and user_b = greatest(v_giver, v_receiver)
      ) then
        v_ok := false;
        exit;
      end if;
    end loop;

    if v_ok then
      delete from public.assignments where event_id = p_event_id;
      insert into public.assignments (event_id, giver_id, receiver_id)
      select p_event_id, v_ids[i], v_ids[(i % v_n) + 1]
      from generate_series(1, v_n) as i;

      update public.events set status = 'drawn', drawn_at = now() where id = p_event_id;
      perform public.write_audit('draw.run', p_event_id,
        jsonb_build_object('participants', v_n, 'attempts', v_attempt));
      return v_n;
    end if;
  end loop;

  raise exception 'draw_impossible' using errcode = 'P0001',
    detail = 'Las exclusiones no permiten un sorteo válido';
end;
$$;

-- Descarta el sorteo (solo si aún no se publicó) y vuelve a abrir el evento.
create function public.reset_draw(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['drawn']::public.event_status[]);
  delete from public.assignments where event_id = p_event_id;
  update public.events set status = 'open', drawn_at = null where id = p_event_id;
  perform public.write_audit('draw.reset', p_event_id);
end;
$$;

-- Publica: a partir de aquí cada participante ve su destinatario y el sorteo es definitivo.
create function public.publish_draw(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['drawn']::public.event_status[]);
  update public.events set status = 'published', published_at = now() where id = p_event_id;
  perform public.write_audit('draw.publish', p_event_id);
end;
$$;

create function public.finish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['published']::public.event_status[]);
  update public.events set status = 'finished' where id = p_event_id;
  perform public.write_audit('event.finish', p_event_id);
end;
$$;

-- Resumen para el admin: solo conteos y si el sorteo es consistente. NUNCA las parejas.
create function public.draw_summary(p_event_id uuid)
returns table (confirmed integer, assigned integer, is_valid boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  with c as (
    select ep.user_id
    from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event_id and ep.status = 'confirmed'
  ), a as (
    select giver_id, receiver_id from public.assignments where event_id = p_event_id
  )
  select
    (select count(*) from c)::integer,
    (select count(*) from a)::integer,
    (select count(*) from a) > 0
      and (select count(*) from a) = (select count(*) from c)
      and not exists (select 1 from a where giver_id not in (select user_id from c))
      and not exists (select 1 from a where receiver_id not in (select user_id from c));
end;
$$;

-- ---------------------------------------------------------------------------
-- Funciones del participante
-- ---------------------------------------------------------------------------
create function public.respond_participation(p_event_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_event(p_event_id, array['open']::public.event_status[]);
  if exists (
    select 1 from public.events
    where id = p_event_id and registration_deadline is not null and registration_deadline < now()
  ) then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  update public.event_participants
  set status = case when p_accept then 'confirmed' else 'declined' end::public.participation_status,
      responded_at = now()
  where event_id = p_event_id and user_id = (select auth.uid());
  if not found then
    raise exception 'not_invited' using errcode = 'P0001';
  end if;
end;
$$;

-- El admin marca la respuesta de alguien (p. ej. quien no entra nunca a la app).
create function public.admin_set_participation(
  p_event_id uuid,
  p_user_id uuid,
  p_status public.participation_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['draft', 'open']::public.event_status[]);
  update public.event_participants
  set status = p_status,
      responded_at = case when p_status = 'invited' then null else now() end
  where event_id = p_event_id and user_id = p_user_id;
  if not found then
    raise exception 'not_invited' using errcode = 'P0001';
  end if;
  perform public.write_audit('participant.set_status', p_event_id,
    jsonb_build_object('user_id', p_user_id, 'status', p_status));
end;
$$;

-- El destinatario del usuario actual (solo tras publicar). Nunca expone quién le regala a él.
create function public.get_my_assignment(p_event_id uuid)
returns table (
  receiver_id uuid,
  full_name text,
  department text,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.department, p.avatar_path
  from public.assignments a
  join public.events e on e.id = a.event_id
  join public.profiles p on p.id = a.receiver_id
  where a.event_id = p_event_id
    and a.giver_id = (select auth.uid())
    and e.status in ('published', 'finished');
$$;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones
-- ---------------------------------------------------------------------------
revoke execute on function public.open_event(uuid) from public, anon;
revoke execute on function public.run_draw(uuid) from public, anon;
revoke execute on function public.reset_draw(uuid) from public, anon;
revoke execute on function public.publish_draw(uuid) from public, anon;
revoke execute on function public.finish_event(uuid) from public, anon;
revoke execute on function public.draw_summary(uuid) from public, anon;
revoke execute on function public.respond_participation(uuid, boolean) from public, anon;
revoke execute on function public.get_my_assignment(uuid) from public, anon;
revoke execute on function public.admin_set_participation(uuid, uuid, public.participation_status) from public, anon;

grant execute on function public.open_event(uuid) to authenticated;
grant execute on function public.run_draw(uuid) to authenticated;
grant execute on function public.reset_draw(uuid) to authenticated;
grant execute on function public.publish_draw(uuid) to authenticated;
grant execute on function public.finish_event(uuid) to authenticated;
grant execute on function public.draw_summary(uuid) to authenticated;
grant execute on function public.respond_participation(uuid, boolean) to authenticated;
grant execute on function public.get_my_assignment(uuid) to authenticated;
grant execute on function public.admin_set_participation(uuid, uuid, public.participation_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios de tablas y RLS
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.exclusions enable row level security;
alter table public.assignments enable row level security;

revoke all on table public.events from anon, authenticated;
revoke all on table public.event_participants from anon, authenticated;
revoke all on table public.exclusions from anon, authenticated;
revoke all on table public.assignments from anon, authenticated; -- sin políticas: inaccesible

-- events: el estado solo cambia mediante las funciones del ciclo de vida.
grant select on table public.events to authenticated;
grant insert (name, description, rules, budget_amount, currency, location, registration_deadline, exchange_at)
  on table public.events to authenticated;
grant update (name, description, rules, budget_amount, currency, location, registration_deadline, exchange_at)
  on table public.events to authenticated;
grant delete on table public.events to authenticated;

create policy "Participants see published events, admins all"
  on public.events for select to authenticated
  using (status <> 'draft' or (select public.is_admin()));

create policy "Admins create events"
  on public.events for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit events"
  on public.events for update to authenticated
  using ((select public.is_admin()) and status <> 'finished')
  with check ((select public.is_admin()));

create policy "Admins delete draft events"
  on public.events for delete to authenticated
  using ((select public.is_admin()) and status = 'draft');

-- event_participants: quién participa no es secreto; las respuestas van por respond_participation.
grant select on table public.event_participants to authenticated;
grant insert (event_id, user_id) on table public.event_participants to authenticated;
grant delete on table public.event_participants to authenticated;

create policy "Authenticated see participants of visible events"
  on public.event_participants for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.events e where e.id = event_id and e.status <> 'draft')
  );

create policy "Admins add participants before the draw"
  on public.event_participants for insert to authenticated
  with check ((select public.is_admin()) and public.event_is_editable(event_id));

create policy "Admins remove participants before the draw"
  on public.event_participants for delete to authenticated
  using ((select public.is_admin()) and public.event_is_editable(event_id));

-- exclusions: solo admin, solo antes del sorteo.
grant select, insert (event_id, user_a, user_b), delete on table public.exclusions to authenticated;

create policy "Admins read exclusions"
  on public.exclusions for select to authenticated
  using ((select public.is_admin()));

create policy "Admins add exclusions before the draw"
  on public.exclusions for insert to authenticated
  with check ((select public.is_admin()) and public.event_is_editable(event_id));

create policy "Admins remove exclusions before the draw"
  on public.exclusions for delete to authenticated
  using ((select public.is_admin()) and public.event_is_editable(event_id));

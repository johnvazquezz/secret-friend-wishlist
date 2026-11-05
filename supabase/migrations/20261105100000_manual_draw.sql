-- Sorteo hecho fuera de la app (papelitos).
--
-- El admin marca el evento como "sorteo ya hecho": queda publicado sin asignaciones y cada
-- participante registra él mismo a quién le regala. La privacidad se mantiene:
--   * nadie (tampoco el admin) ve quién registró a quién;
--   * las restricciones de `assignments` (un destinatario por persona, nadie repetido, nadie se
--     regala a sí mismo) siguen aplicándose en la base de datos;
--   * si alguien elige a una persona ya registrada solo se le dice "ya está registrada",
--     nunca por quién.

alter table public.events
  add column draw_mode text not null default 'app' check (draw_mode in ('app', 'manual'));
-- Sin privilegio de insert/update para clientes: solo cambia mediante start_manual_event().

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create function public.start_manual_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['draft', 'open']::public.event_status[]);

  -- Con papelitos, todos los de la lista participan salvo quien dijo que no.
  update public.event_participants
  set status = 'confirmed', responded_at = coalesce(responded_at, now())
  where event_id = p_event_id and status = 'invited';

  select count(*) into v_n
  from public.event_participants ep
  join public.profiles p on p.id = ep.user_id and p.is_active
  where ep.event_id = p_event_id and ep.status = 'confirmed';

  if v_n < 3 then
    raise exception 'not_enough_participants' using errcode = 'P0001',
      detail = format('Confirmados: %s (mínimo 3)', v_n);
  end if;

  delete from public.exclusions where event_id = p_event_id; -- no aplican sin sorteo en la app
  update public.events
  set draw_mode = 'manual', status = 'published', drawn_at = now(), published_at = now()
  where id = p_event_id;
  perform public.write_audit('draw.manual_start', p_event_id, jsonb_build_object('participants', v_n));
  return v_n;
end;
$$;

-- Libera el registro de una persona como DESTINATARIO (p. ej. alguien la eligió por error).
-- No revela quién la había registrado; a esa persona le llega un aviso para registrarse de nuevo.
create function public.admin_release_recipient(p_event_id uuid, p_receiver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_giver uuid;
  v_name text;
begin
  perform public.require_admin();
  perform public.lock_event(p_event_id, array['published']::public.event_status[]);
  if not exists (select 1 from public.events where id = p_event_id and draw_mode = 'manual') then
    raise exception 'not_manual_event' using errcode = 'P0001';
  end if;

  delete from public.assignments
  where event_id = p_event_id and receiver_id = p_receiver_id
  returning giver_id into v_giver;
  if v_giver is null then
    raise exception 'not_claimed' using errcode = 'P0001';
  end if;

  select name into v_name from public.events where id = p_event_id;
  perform public.notify(v_giver, 'claim_released',
    'Tu registro de amigo secreto se anuló',
    'El organizador liberó la persona que habías registrado. Revisa tu papelito y vuelve a registrar a tu amigo secreto.',
    '/', null);
  -- Solo se audita el destinatario liberado, nunca quién lo tenía.
  perform public.write_audit('draw.manual_release', p_event_id,
    jsonb_build_object('receiver_id', p_receiver_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Participante
-- ---------------------------------------------------------------------------
create function public.require_manual_participant(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_event(p_event_id, array['published']::public.event_status[]);
  if not exists (select 1 from public.events where id = p_event_id and draw_mode = 'manual') then
    raise exception 'not_manual_event' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event_id and ep.user_id = p_user_id and ep.status = 'confirmed'
  ) then
    raise exception 'not_participant' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.require_manual_participant(uuid, uuid) from public, anon, authenticated;

-- ¿Hay mensajes en la conversación con mi destinatario? Entonces ya no se puede cambiar.
create function public.my_claim_is_locked(p_event_id uuid, p_giver uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    join public.messages m on m.thread_id = a.thread_id
    where a.event_id = p_event_id and a.giver_id = p_giver
  );
$$;

revoke execute on function public.my_claim_is_locked(uuid, uuid) from public, anon, authenticated;

-- Registra (o cambia, si aún no hay mensajes) a quién le regala el usuario actual.
create function public.claim_recipient(p_event_id uuid, p_receiver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_previous uuid;
begin
  perform public.require_manual_participant(p_event_id, v_me); -- bloquea el evento: claims en serie

  if p_receiver_id = v_me then
    raise exception 'cannot_claim_self' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event_id and ep.user_id = p_receiver_id and ep.status = 'confirmed'
  ) then
    raise exception 'recipient_not_participant' using errcode = 'P0001';
  end if;

  select receiver_id into v_previous
  from public.assignments where event_id = p_event_id and giver_id = v_me;
  if v_previous = p_receiver_id then
    return; -- sin cambios
  end if;
  if exists (
    select 1 from public.assignments
    where event_id = p_event_id and receiver_id = p_receiver_id
  ) then
    raise exception 'recipient_taken' using errcode = 'P0001';
  end if;
  if v_previous is not null then
    if public.my_claim_is_locked(p_event_id, v_me) then
      raise exception 'claim_locked' using errcode = 'P0001';
    end if;
    delete from public.assignments where event_id = p_event_id and giver_id = v_me;
  end if;

  insert into public.assignments (event_id, giver_id, receiver_id)
  values (p_event_id, v_me, p_receiver_id);

  perform public.notify(p_receiver_id, 'claimed',
    'Tu amigo secreto ya está en la app 🎁',
    'Ya puede ver tu lista de deseos y escribirte de forma anónima.',
    '/mensajes', 'claimed:' || p_event_id || ':' || p_receiver_id);
end;
$$;

-- Deshace el registro propio (solo si aún no hay mensajes).
create function public.release_my_claim(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  perform public.require_manual_participant(p_event_id, v_me);
  if public.my_claim_is_locked(p_event_id, v_me) then
    raise exception 'claim_locked' using errcode = 'P0001';
  end if;
  delete from public.assignments where event_id = p_event_id and giver_id = v_me;
end;
$$;

-- ¿Puedo cambiar mi registro? (sin mensajes en la conversación con mi destinatario)
create function public.can_change_my_claim(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.my_claim_is_locked(p_event_id, (select auth.uid()));
$$;

revoke execute on function public.start_manual_event(uuid) from public, anon;
revoke execute on function public.admin_release_recipient(uuid, uuid) from public, anon;
revoke execute on function public.claim_recipient(uuid, uuid) from public, anon;
revoke execute on function public.release_my_claim(uuid) from public, anon;
revoke execute on function public.can_change_my_claim(uuid) from public, anon;
grant execute on function public.start_manual_event(uuid) to authenticated;
grant execute on function public.admin_release_recipient(uuid, uuid) to authenticated;
grant execute on function public.claim_recipient(uuid, uuid) to authenticated;
grant execute on function public.release_my_claim(uuid) to authenticated;
grant execute on function public.can_change_my_claim(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Participantes que se añaden tarde (alguien olvidado en la lista)
-- ---------------------------------------------------------------------------
drop policy "Admins add participants before the draw" on public.event_participants;

create policy "Admins add participants before the draw or in manual events"
  on public.event_participants for insert to authenticated
  with check (
    (select public.is_admin())
    and (
      public.event_is_editable(event_id)
      or exists (
        select 1 from public.events e
        where e.id = event_id and e.status = 'published' and e.draw_mode = 'manual'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------------
create or replace function public.on_event_status_change()
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
  elsif new.status = 'published' and new.draw_mode = 'manual' then
    for r in
      select user_id from public.event_participants
      where event_id = new.id and status = 'confirmed'
    loop
      perform public.notify(r.user_id, 'manual_claim',
        'Registra a tu amigo secreto 📝',
        'Elige en la app a la persona de tu papelito para ver su lista de deseos y poder escribirle.',
        '/', 'manual_claim:' || new.id);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.on_participant_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  select id, name, status, draw_mode into v_event from public.events where id = new.event_id;
  if v_event.status = 'open' then
    perform public.notify(new.user_id, 'event_open',
      '¡Arrancó el ' || v_event.name || '!',
      'Confirma si participas y prepara tu lista de deseos.',
      '/', 'event_open:' || v_event.id);
  elsif v_event.status = 'published' and v_event.draw_mode = 'manual' then
    -- Añadido tarde a un sorteo de papelitos: participa directamente.
    update public.event_participants
    set status = 'confirmed', responded_at = now()
    where event_id = new.event_id and user_id = new.user_id;
    perform public.notify(new.user_id, 'manual_claim',
      'Registra a tu amigo secreto 📝',
      'Elige en la app a la persona de tu papelito para ver su lista de deseos y poder escribirle.',
      '/', 'manual_claim:' || v_event.id);
  end if;
  return new;
end;
$$;

-- Recordatorio diario para quien aún no registró a su amigo secreto.
create function public.send_manual_claim_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_count integer := 0;
  r record;
begin
  select * into v_event from public.events
  where status = 'published' and draw_mode = 'manual'
  order by created_at desc limit 1;
  if not found then
    return 0;
  end if;

  for r in
    select ep.user_id from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = v_event.id and ep.status = 'confirmed'
      and not exists (
        select 1 from public.assignments a
        where a.event_id = v_event.id and a.giver_id = ep.user_id
      )
  loop
    perform public.notify(r.user_id, 'reminder_claim',
      'Aún no registraste a tu amigo secreto',
      'Entra y elige a la persona de tu papelito para ver su lista de deseos.',
      '/', 'reminder_claim:' || v_event.id || ':' || current_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.send_manual_claim_reminders() from public, anon, authenticated;

select cron.schedule(
  'amigo-secreto-claim-reminders',
  '5 14 * * *',
  $$select public.send_manual_claim_reminders()$$
);

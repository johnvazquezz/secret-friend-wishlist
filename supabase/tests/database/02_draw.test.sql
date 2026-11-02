-- Pruebas del evento y del sorteo (pgTAP). Ejecutar con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

-- Crea un usuario de prueba (el trigger crea su perfil).
create function pg_temp.make_user(p_email text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
          jsonb_build_object('full_name', p_email));
  return v_id;
end $$;

-- ¿El sorteo actual es un ciclo único válido que respeta las exclusiones? Devuelve null si es válido
-- o el motivo del fallo.
create function pg_temp.draw_problem(p_event uuid) returns text language plpgsql as $$
declare
  v_n integer;
  v_start uuid;
  v_cur uuid;
  v_steps integer := 0;
begin
  select count(*) into v_n from public.event_participants ep
    join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event and ep.status = 'confirmed';
  if (select count(*) from public.assignments where event_id = p_event) <> v_n then
    return 'número de asignaciones distinto de confirmados';
  end if;
  if exists (
    select 1 from public.event_participants ep join public.profiles p on p.id = ep.user_id and p.is_active
    where ep.event_id = p_event and ep.status = 'confirmed'
      and (not exists (select 1 from public.assignments a where a.event_id = p_event and a.giver_id = ep.user_id)
        or not exists (select 1 from public.assignments a where a.event_id = p_event and a.receiver_id = ep.user_id))
  ) then
    return 'algún confirmado no regala o no recibe';
  end if;
  if exists (select 1 from public.assignments a join public.exclusions x
             on x.event_id = a.event_id
            and x.user_a = least(a.giver_id, a.receiver_id)
            and x.user_b = greatest(a.giver_id, a.receiver_id)
             where a.event_id = p_event) then
    return 'se violó una exclusión';
  end if;
  select giver_id into v_start from public.assignments where event_id = p_event limit 1;
  v_cur := v_start;
  loop
    select receiver_id into v_cur from public.assignments where event_id = p_event and giver_id = v_cur;
    v_steps := v_steps + 1;
    exit when v_cur = v_start or v_steps > v_n;
  end loop;
  if v_steps <> v_n then
    return format('no es un ciclo único (%s de %s)', v_steps, v_n);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Datos: 1 admin + 40 participantes
-- ---------------------------------------------------------------------------
create temp table t_users (n integer primary key, id uuid not null) on commit drop;
insert into t_users select 0, pg_temp.make_user('admin-draw@test.local');
update public.profiles set role = 'admin', must_change_password = false
  where id = (select id from t_users where n = 0);
insert into t_users select g, pg_temp.make_user(format('p%s@test.local', g)) from generate_series(1, 40) g;
grant select on t_users to authenticated;

create temp table t_event (id uuid) on commit drop;
grant select, insert on t_event to authenticated;

-- ---------------------------------------------------------------------------
-- Admin crea el evento en borrador
-- ---------------------------------------------------------------------------
select pg_temp.login_as((select id from t_users where n = 0));
insert into public.events (name, budget_amount) values ('Navidad 2026', 25);
insert into t_event select id from public.events where name = 'Navidad 2026';
select is(
  (select created_by from public.events where id = (select id from t_event)),
  (select id from t_users where n = 0), 'created_by se rellena con el admin'
);
select throws_ok(
  $$ update public.events set status = 'published' $$, '42501', null,
  'ni el admin cambia el estado sin pasar por las funciones'
);
insert into public.event_participants (event_id, user_id)
  select (select id from t_event), id from t_users where n between 1 and 5;
select pg_temp.logout();

-- Borrador invisible para participantes
select pg_temp.login_as((select id from t_users where n = 1));
select is((select count(*) from public.events)::int, 0, 'participante no ve eventos en borrador');
select throws_ok(
  $$ insert into public.events (name) values ('pirata') $$, '42501', null,
  'participante no crea eventos'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Inscripción
-- ---------------------------------------------------------------------------
select pg_temp.login_as((select id from t_users where n = 0));
select public.open_event((select id from t_event));
select pg_temp.logout();

select pg_temp.login_as((select id from t_users where n = 1));
select is((select count(*) from public.events)::int, 1, 'participante ve el evento abierto');
select lives_ok(
  $$ select public.respond_participation((select id from t_event), true) $$,
  'participante confirma su participación'
);
select throws_ok(
  $$ select public.run_draw((select id from t_event)) $$, '42501', 'not_admin',
  'participante no puede sortear'
);
select pg_temp.logout();

select pg_temp.login_as((select id from t_users where n = 6));
select throws_ok(
  $$ select public.respond_participation((select id from t_event), true) $$, 'P0001', 'not_invited',
  'un no invitado no puede apuntarse'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Validaciones del sorteo
-- ---------------------------------------------------------------------------
select pg_temp.login_as((select id from t_users where n = 0));
select throws_ok(
  $$ select public.run_draw((select id from t_event)) $$, 'P0001', 'not_enough_participants',
  'no sortea con menos de 3 confirmados'
);
select pg_temp.logout();

update public.event_participants set status = 'confirmed' where event_id = (select id from t_event);
-- 3 personas que se excluyen entre sí → imposible
insert into public.exclusions (event_id, user_a, user_b)
  select (select id from t_event), least(a.id, b.id), greatest(a.id, b.id)
  from t_users a join t_users b on a.n < b.n
  where a.n between 1 and 3 and b.n between 1 and 3;
update public.event_participants set status = 'declined'
  where event_id = (select id from t_event) and user_id in (select id from t_users where n in (4, 5));

select pg_temp.login_as((select id from t_users where n = 0));
select throws_ok(
  $$ select public.run_draw((select id from t_event)) $$, 'P0001', 'draw_impossible',
  'detecta exclusiones imposibles'
);
select pg_temp.logout();
delete from public.exclusions;

-- ---------------------------------------------------------------------------
-- Prueba de propiedades: 300 sorteos con tamaños y exclusiones aleatorias
-- ---------------------------------------------------------------------------
insert into public.event_participants (event_id, user_id)
  select (select id from t_event), id from t_users where n between 6 and 40;

do $$
declare
  v_event uuid := (select id from t_event);
  v_admin uuid := (select id from t_users where n = 0);
  v_size integer;
  v_problem text;
  v_run integer;
begin
  for v_run in 1 .. 300 loop
    v_size := 3 + floor(random() * 38)::int; -- 3..40
    update public.event_participants
      set status = case when user_id in (select id from t_users where n between 1 and v_size)
                        then 'confirmed' else 'declined' end::public.participation_status
      where event_id = v_event;
    delete from public.exclusions where event_id = v_event;
    if v_size >= 6 then
      -- ~ v_size/4 exclusiones aleatorias entre confirmados
      insert into public.exclusions (event_id, user_a, user_b)
      select distinct v_event, least(a.id, b.id), greatest(a.id, b.id)
      from generate_series(1, v_size / 4) g
      cross join lateral (select id from t_users where n between 1 and v_size order by random() limit 1) a
      cross join lateral (select id from t_users where n between 1 and v_size and id <> a.id order by random() limit 1) b
      on conflict do nothing;
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.run_draw(v_event);
    v_problem := pg_temp.draw_problem(v_event);
    if v_problem is not null then
      raise exception 'Sorteo inválido en la ejecución % (n=%): %', v_run, v_size, v_problem;
    end if;
    perform public.reset_draw(v_event);
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;
select pass('300 sorteos aleatorios (3–40 personas, con exclusiones): todos son ciclos únicos válidos');

-- Las cuentas desactivadas no entran en el sorteo
update public.event_participants set status = 'confirmed' where event_id = (select id from t_event);
update public.profiles set is_active = false where id = (select id from t_users where n = 40);
select pg_temp.login_as((select id from t_users where n = 0));
select is(public.run_draw((select id from t_event)), 39, 'sorteo final con 39 activos (el inactivo queda fuera)');
select pg_temp.logout();
select is(pg_temp.draw_problem((select id from t_event)), null, 'el sorteo final es válido');
select is(
  (select count(*) from public.assignments
   where giver_id = (select id from t_users where n = 40) or receiver_id = (select id from t_users where n = 40))::int,
  0, 'el usuario inactivo no tiene asignación'
);

-- ---------------------------------------------------------------------------
-- Privacidad
-- ---------------------------------------------------------------------------
select pg_temp.login_as((select id from t_users where n = 0));
select throws_ok($$ select * from public.assignments $$, '42501', null, 'el ADMIN no puede leer asignaciones');
select results_eq(
  $$ select confirmed, assigned, is_valid from public.draw_summary((select id from t_event)) $$,
  $$ values (39, 39, true) $$,
  'el admin solo ve conteos del sorteo'
);
select throws_ok(
  $$ select public.run_draw((select id from t_event)) $$, 'P0001', 'invalid_event_status',
  'no se puede sortear dos veces'
);
select throws_ok(
  $$ insert into public.event_participants (event_id, user_id)
     values ((select id from t_event), (select id from t_users where n = 40)) $$,
  '42501', null, 'no se agregan participantes tras el sorteo'
);
select pg_temp.logout();

select pg_temp.login_as((select id from t_users where n = 1));
select throws_ok($$ select * from public.assignments $$, '42501', null, 'participante no lee asignaciones');
select is(
  (select count(*) from public.get_my_assignment((select id from t_event)))::int, 0,
  'antes de publicar nadie ve su destinatario'
);
select throws_ok(
  $$ select * from public.draw_summary((select id from t_event)) $$, '42501', 'not_admin',
  'participante no ve el resumen del sorteo'
);
select pg_temp.logout();

select pg_temp.login_as((select id from t_users where n = 0));
select public.publish_draw((select id from t_event));
select throws_ok(
  $$ select public.reset_draw((select id from t_event)) $$, 'P0001', 'invalid_event_status',
  'tras publicar el sorteo es definitivo'
);
select pg_temp.logout();

create temp table t_expected on commit drop as
  select receiver_id from public.assignments
  where event_id = (select id from t_event) and giver_id = (select id from t_users where n = 1);
grant select on t_expected to authenticated;

select pg_temp.login_as((select id from t_users where n = 1));
select is(
  (select count(*) from public.get_my_assignment((select id from t_event)))::int, 1,
  'tras publicar el participante ve a su destinatario'
);
select is(
  (select receiver_id from public.get_my_assignment((select id from t_event))),
  (select receiver_id from t_expected),
  'y es exactamente su destinatario'
);
select pg_temp.logout();

select pg_temp.login_as((select id from t_users where n = 40));
select is(
  (select count(*) from public.get_my_assignment((select id from t_event)))::int, 0,
  'quien no participa no obtiene destinatario'
);
select pg_temp.logout();

select * from finish();
rollback;

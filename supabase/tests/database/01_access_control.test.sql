-- Pruebas de control de acceso (pgTAP). Ejecutar con: npm run db:test
-- Se apoyan en los usuarios de supabase/seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Helpers para simular peticiones de PostgREST con un usuario concreto.
create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

-- ---------------------------------------------------------------------------
-- anon: no puede leer nada
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select name from public.team_members $$, '42501', null, 'anon no lee team_members');
select throws_ok($$ select id from public.profiles $$, '42501', null, 'anon no lee profiles');
select throws_ok($$ select id from public.audit_log $$, '42501', null, 'anon no lee audit_log');
select throws_ok(
  $$ update public.team_members set wishes = 'hackeado' $$, '42501', null,
  'anon no modifica team_members'
);
reset role;

-- ---------------------------------------------------------------------------
-- Participante (Ana)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');

select lives_ok($$ select id, name, wishes from public.team_members $$, 'participante lee deseos');
select throws_ok(
  $$ select access_code from public.team_members $$, '42501', null,
  'participante NO lee access_code'
);
select throws_ok(
  $$ update public.team_members set wishes = 'x' $$, '42501', null,
  'participante no modifica team_members'
);
select cmp_ok((select count(*) from public.profiles)::int, '>=', 3, 'participante ve el directorio de perfiles');

-- Puede editar su nombre y departamento
update public.profiles set full_name = 'Ana P.' where id = '00000000-0000-4000-8000-000000000002';
select is(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'Ana P.', 'participante edita su propio nombre'
);

-- No puede editar a otros (RLS filtra la fila: 0 filas afectadas)
update public.profiles set full_name = 'Pirata' where id = '00000000-0000-4000-8000-000000000003';
select isnt(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000003'),
  'Pirata', 'participante no edita perfiles ajenos'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'participante no puede auto-asignarse admin'
);
select throws_ok(
  $$ update public.profiles set is_active = true, must_change_password = false
     where id = '00000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'participante no cambia is_active / must_change_password directamente'
);
select throws_ok(
  $$ update public.profiles set avatar_path = 'otro/avatar.webp'
     where id = '00000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'avatar_path debe apuntar a la carpeta propia'
);
select throws_ok(
  $$ insert into public.profiles (id, email, full_name) values (gen_random_uuid(), 'x@x.com', 'X') $$,
  '42501', null, 'participante no crea perfiles'
);
select is((select count(*) from public.audit_log)::int, 0, 'participante no ve audit_log');
select is(public.is_admin(), false, 'is_admin() es false para participante');

select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Usuario con contraseña temporal (Luis)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select public.complete_password_change();
select pg_temp.logout();
select is(
  (select must_change_password from public.profiles where id = '00000000-0000-4000-8000-000000000003'),
  false, 'complete_password_change limpia la marca del propio usuario'
);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select is(public.is_admin(), true, 'is_admin() es true para admin');
update public.profiles set department = 'Ventas' where id = '00000000-0000-4000-8000-000000000003';
select is(
  (select department from public.profiles where id = '00000000-0000-4000-8000-000000000003'),
  'Ventas', 'admin edita datos básicos de cualquier perfil'
);
select pg_temp.logout();

select * from finish();
rollback;

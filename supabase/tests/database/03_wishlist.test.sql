-- Pruebas de la lista de deseos y de los gustos personales (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

-- Usuarios del seed
-- admin 001, ana 002, luis 003, maria 004

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select id from public.wishlist_items $$, '42501', null, 'anon no lee deseos');
select throws_ok($$ select likes from public.user_preferences $$, '42501', null, 'anon no lee gustos');
reset role;

-- ---------------------------------------------------------------------------
-- Ana gestiona su lista
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ insert into public.wishlist_items (title, priority) values ('Libro de cocina', 1) $$,
  'agrega un deseo propio'
);
select is(
  (select user_id from public.wishlist_items where title = 'Libro de cocina'),
  '00000000-0000-4000-8000-000000000002'::uuid, 'user_id se asigna automáticamente'
);
select throws_ok(
  $$ insert into public.wishlist_items (user_id, title) values ('00000000-0000-4000-8000-000000000003', 'x') $$,
  '42501', null, 'no puede crear deseos a nombre de otro'
);
select throws_ok(
  $$ insert into public.wishlist_items (title) values ('   ') $$,
  '23514', null, 'rechaza títulos vacíos'
);
update public.wishlist_items set notes = 'Tapa dura' where title = 'Libro de cocina';
select is(
  (select notes from public.wishlist_items where title = 'Libro de cocina'), 'Tapa dura',
  'edita su deseo'
);
insert into public.user_preferences (likes, sizes, allergies) values ('Café', 'M', 'Nueces');
select is((select sizes from public.user_preferences), 'M', 'guarda y lee sus gustos');
select pg_temp.logout();

-- Límite de 20
select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
insert into public.wishlist_items (title) select 'Deseo ' || g from generate_series(1, 20) g;
select throws_ok(
  $$ insert into public.wishlist_items (title) values ('Uno más') $$, 'P0001', 'wishlist_limit',
  'máximo 20 deseos por persona'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Luis: ve los deseos de Ana, pero no puede tocarlos ni ver sus gustos
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is(
  (select count(*) from public.wishlist_items where user_id = '00000000-0000-4000-8000-000000000002')::int,
  1, 'cualquiera ve la lista de deseos de otro'
);
update public.wishlist_items set title = 'Pirata' where user_id = '00000000-0000-4000-8000-000000000002';
delete from public.wishlist_items where user_id = '00000000-0000-4000-8000-000000000002';
select pg_temp.logout();
select is(
  (select title from public.wishlist_items where user_id = '00000000-0000-4000-8000-000000000002'),
  'Libro de cocina', 'nadie edita ni borra deseos ajenos'
);

select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.user_preferences)::int, 0, 'no ve los gustos de otros');
select throws_ok(
  $$ update public.user_preferences set user_id = '00000000-0000-4000-8000-000000000003' $$,
  '42501', null, 'no puede reasignar gustos'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Gustos del destinatario: solo su giver y solo tras publicar
-- ---------------------------------------------------------------------------
insert into public.events (id, name, status, created_by)
values ('10000000-0000-4000-8000-000000000001', 'Test', 'drawn', '00000000-0000-4000-8000-000000000001');
-- Ciclo: luis → ana → maria → luis
insert into public.assignments (event_id, giver_id, receiver_id) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003');

select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is(
  (select count(*) from public.get_my_recipient_preferences('10000000-0000-4000-8000-000000000001'))::int,
  0, 'antes de publicar el giver no ve los gustos'
);
select pg_temp.logout();

update public.events set status = 'published' where id = '10000000-0000-4000-8000-000000000001';

select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select results_eq(
  $$ select likes, sizes, allergies from public.get_my_recipient_preferences('10000000-0000-4000-8000-000000000001') $$,
  $$ values ('Café'::text, 'M'::text, 'Nueces'::text) $$,
  'tras publicar, el giver (Luis) ve los gustos de su destinataria (Ana)'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
select is(
  (select count(*) from public.get_my_recipient_preferences('10000000-0000-4000-8000-000000000001'))::int,
  0, 'María (que no regala a Ana) no ve sus gustos'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select is(
  (select count(*) from public.get_my_recipient_preferences('10000000-0000-4000-8000-000000000001'))::int,
  0, 'el admin tampoco ve gustos ajenos'
);
select is((select count(*) from public.user_preferences)::int, 0, 'ni por lectura directa');
select pg_temp.logout();

insert into public.user_preferences (user_id, likes) values
  ('00000000-0000-4000-8000-000000000003', 'gustos de Luis'),
  ('00000000-0000-4000-8000-000000000004', 'gustos de María');
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select likes from public.get_my_recipient_preferences('10000000-0000-4000-8000-000000000001') $$,
  $$ values ('gustos de María'::text) $$,
  'Ana obtiene los gustos de su destinataria (María), nunca los de quien le regala (Luis)'
);
select pg_temp.logout();

select * from finish();
rollback;

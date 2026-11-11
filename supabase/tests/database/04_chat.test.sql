-- Pruebas del chat anónimo (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

-- Usuarios del seed: admin 001, ana 002, luis 003, maria 004, pedro 005
-- Ciclo: luis → ana → maria → luis   (pedro no participa)
insert into public.events (id, name, status, created_by)
values ('20000000-0000-4000-8000-000000000001', 'Chat', 'drawn', '00000000-0000-4000-8000-000000000001');
insert into public.assignments (event_id, giver_id, receiver_id) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003');

-- Hilo luis → ana (calculado como postgres para comparar)
create temp table t_thread on commit drop as
  select thread_id from public.assignments
  where giver_id = '00000000-0000-4000-8000-000000000003'
    and event_id = '20000000-0000-4000-8000-000000000001';
grant select on t_thread to authenticated;

-- ---------------------------------------------------------------------------
-- Antes de publicar: chat cerrado
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), 'Hola') $$,
  'P0001', 'no_thread', 'no se puede escribir antes de publicar (el hilo aún no existe para nadie)'
);
select is(
  (select count(*) from public.get_my_conversations('20000000-0000-4000-8000-000000000001'))::int, 0,
  'antes de publicar no hay conversaciones'
);
select pg_temp.logout();

update public.events set status = 'published' where id = '20000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Luis (giver de Ana) escribe
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select lives_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), '¡Hola! ¿Qué color te gusta?') $$,
  'el giver escribe a su destinataria'
);
select throws_ok(
  $$ insert into public.messages (thread_id, author_role, body)
     values ((select thread_id from t_thread), 'receiver', 'falso') $$,
  '42501', null, 'nadie inserta mensajes directamente (ni suplantando el rol)'
);
select throws_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), '   ') $$,
  'P0001', 'invalid_message', 'rechaza mensajes vacíos'
);
select results_eq(
  $$ select my_role::text, partner_name, is_my_recipient, my_alias is not null
     from public.get_my_conversations('20000000-0000-4000-8000-000000000001') order by my_role $$,
  $$ values ('giver'::text, 'Ana Pérez'::text, true, true) $$,
  'Luis ve a su destinataria (y su propio alias); el hilo donde le regalan a él no aparece: aún no tiene mensajes'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Ana (receiver) lee y responde sin saber quién es
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select my_role::text, partner_name, partner_avatar_path, partner_alias is not null, is_my_recipient, unread
     from public.get_my_conversations('20000000-0000-4000-8000-000000000001') where my_role = 'receiver' $$,
  $$ values ('receiver'::text, null::text, null::text, true, false, 1) $$,
  'Ana ve un mensaje sin leer de un alias anónimo, sin marca de "amigo secreto"'
);
select is(
  (select body from public.messages where thread_id = (select thread_id from t_thread)),
  '¡Hola! ¿Qué color te gusta?', 'Ana lee el mensaje'
);
select is(
  (select author_role::text from public.messages where thread_id = (select thread_id from t_thread)),
  'giver', 'el mensaje solo indica el rol, no la persona'
);
select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'messages'
     and column_name in ('giver_id', 'receiver_id', 'sender_id', 'user_id'))::int,
  0, 'la tabla messages no tiene ninguna columna que identifique a personas'
);
select throws_ok(
  $$ select giver_id from public.assignments $$, '42501', null,
  'Ana no puede resolver el hilo a una persona leyendo assignments'
);
select lives_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), '¡El morado!') $$,
  'Ana responde a su amigo secreto'
);
select lives_ok(
  $$ select public.mark_thread_read((select thread_id from t_thread)) $$, 'Ana marca como leído'
);
select is(
  (select unread from public.get_my_conversations('20000000-0000-4000-8000-000000000001') where my_role = 'receiver'),
  0, 'ya no tiene mensajes sin leer'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is(
  (select unread from public.get_my_conversations('20000000-0000-4000-8000-000000000001') where my_role = 'giver'),
  1, 'Luis tiene la respuesta de Ana sin leer'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Terceros
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
select is(
  (select count(*) from public.messages where thread_id = (select thread_id from t_thread))::int, 0,
  'María (otro participante) no lee la conversación Luis–Ana'
);
select throws_ok(
  $$ select public.mark_thread_read((select thread_id from t_thread)) $$, 'P0001', 'no_thread',
  'María no puede tocar esa conversación'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), 'Hola') $$,
  'P0001', 'no_thread', 'quien no está en el hilo no puede escribir en él'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select is((select count(*) from public.messages)::int, 0, 'el ADMIN no lee ningún mensaje');
select pg_temp.logout();

set local role anon;
select throws_ok($$ select body from public.messages $$, '42501', null, 'anon no lee mensajes');
reset role;

-- ---------------------------------------------------------------------------
-- Límite anti-spam y cierre
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select lives_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), 'msg ' || g)
     from generate_series(1, 19) g $$,
  'hasta 20 mensajes por minuto'
);
select throws_ok(
  $$ select public.send_thread_message((select thread_id from t_thread), 'uno más') $$,
  'P0001', 'rate_limited', 'el mensaje 21 en un minuto se rechaza'
);
select pg_temp.logout();

select * from finish();
rollback;

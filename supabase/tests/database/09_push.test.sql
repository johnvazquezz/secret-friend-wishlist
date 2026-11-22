-- Pruebas de las notificaciones push (pgTAP): suscripciones, destinatarios y anonimato.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  reset role;
$$;

-- Suscripción de prueba con un endpoint de FCM y claves con formato válido.
create function pg_temp.sub(p_suffix text) returns jsonb language sql as $$
  select jsonb_build_object(
    'endpoint', 'https://fcm.googleapis.com/fcm/send/test-' || p_suffix,
    'expirationTime', null,
    'keys', jsonb_build_object(
      'p256dh', 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      'auth', 'tBHItJI5svbpez7KI4CCXg'
    )
  );
$$;

create temp table t_ids (name text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;

-- Usuarios del seed: admin 001, ana 002, luis 003, maria 004, pedro 005, sofia 006, jorge 007
-- Sorteo: luis → ana → maria → pedro → luis
insert into public.events (id, name, status, created_by) values
  ('60000000-0000-4000-8000-000000000001', 'Push', 'drawn', '00000000-0000-4000-8000-000000000001');
insert into public.event_participants (event_id, user_id, status)
select '60000000-0000-4000-8000-000000000001', id, 'confirmed'
from unnest(array[
  '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'
]::uuid[]) as id;
insert into public.assignments (event_id, giver_id, receiver_id) values
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004'),
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'),
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003');

-- Sin Vault configurado, los triggers no hacen nada y nada falla (publicar crea avisos).
select lives_ok(
  $$ update public.events set status = 'published' where id = '60000000-0000-4000-8000-000000000001' $$,
  'publicar el sorteo (crea avisos) funciona sin push configurado'
);
select is((select count(*) from net.http_request_queue)::int, 0, 'sin configuración no se encola nada');

-- ---------------------------------------------------------------------------
-- Suscripciones
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.register_push_subscription(pg_temp.sub('ana'), 'Mozilla/5.0 (Android)') $$,
  'Ana guarda la suscripción de su celular'
);
select lives_ok(
  $$ select public.register_push_subscription(pg_temp.sub('ana'), 'Mozilla/5.0 (Android)') $$,
  'guardarla otra vez no falla'
);
select is((select count(*) from public.push_subscriptions)::int, 1, 'sin duplicados por endpoint');
select ok(
  (select not (subscription ? 'expirationTime') from public.push_subscriptions),
  'solo se guarda endpoint y claves'
);
select throws_ok(
  $$ select public.register_push_subscription(
       jsonb_set(pg_temp.sub('x'), '{endpoint}', '"http://fcm.googleapis.com/fcm/send/x"'), null) $$,
  'P0001', 'invalid_subscription', 'el endpoint debe ser https'
);
select throws_ok(
  $$ select public.register_push_subscription(
       jsonb_set(pg_temp.sub('x'), '{endpoint}', '"https://evil.example.com/fcm.googleapis.com/x"'), null) $$,
  'P0001', 'invalid_subscription', 'solo servicios push conocidos'
);
select throws_ok(
  $$ select public.register_push_subscription(pg_temp.sub('x') #- '{keys,auth}', null) $$,
  'P0001', 'invalid_subscription', 'faltan claves'
);
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, subscription)
     values ('00000000-0000-4000-8000-000000000002', pg_temp.sub('directo')) $$,
  '42501', null, 'no se puede insertar directamente'
);
select throws_ok(
  $$ update public.push_subscriptions set user_id = '00000000-0000-4000-8000-000000000003' $$,
  '42501', null, 'no se puede modificar directamente'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.push_subscriptions)::int, 0, 'Luis no ve las suscripciones de Ana');
delete from public.push_subscriptions;
select pg_temp.logout();
select is(
  (select count(*) from public.push_subscriptions where user_id = '00000000-0000-4000-8000-000000000002')::int,
  1, 'Luis no puede borrar las de Ana'
);

-- Mismo navegador, otra persona (PC compartida): la suscripción pasa a Luis.
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select public.register_push_subscription(pg_temp.sub('ana'), null);
select pg_temp.logout();
select results_eq(
  $$ select user_id from public.push_subscriptions where endpoint like '%test-ana' $$,
  $$ values ('00000000-0000-4000-8000-000000000003'::uuid) $$,
  'el endpoint se reasigna a quien lo registra ahora'
);

-- Ana borra las suyas (RLS) y tiene como mucho 10 dispositivos
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select public.register_push_subscription(pg_temp.sub('ana-' || i), null) from generate_series(1, 12) i;
select is((select count(*) from public.push_subscriptions)::int, 10, 'como mucho 10 dispositivos por persona');
delete from public.push_subscriptions where id = (select id from public.push_subscriptions limit 1);
select is((select count(*) from public.push_subscriptions)::int, 9, 'cada persona borra las suyas');
select pg_temp.logout();

set local role anon;
select throws_ok(
  $$ select public.register_push_subscription(pg_temp.sub('anon'), null) $$,
  '42501', null, 'anon no puede registrar suscripciones'
);
reset role;

-- ---------------------------------------------------------------------------
-- Quién recibe cada mensaje y con qué título
-- ---------------------------------------------------------------------------
insert into t_ids
select 'hilo_maria_pedro', thread_id from public.assignments
where event_id = '60000000-0000-4000-8000-000000000001' and giver_id = '00000000-0000-4000-8000-000000000004';

-- María (regala a Pedro) le escribe desde el hilo del sorteo; Pedro responde.
select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
insert into t_ids values ('m_maria', public.send_thread_message(
  (select id from t_ids where name = 'hilo_maria_pedro'), '¿Qué color te gusta más?'));
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
insert into t_ids values ('m_pedro', public.send_thread_message(
  (select id from t_ids where name = 'hilo_maria_pedro'), 'El verde 💚'));
select pg_temp.logout();

-- Ana escribe EN SECRETO a Pedro (chat libre); Pedro responde. Luis escribe con nombre a María.
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into t_ids values ('hilo_ana_pedro', public.start_conversation(
  '60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', true, 'Te observo 👀'));
select pg_temp.logout();
insert into t_ids
select 'm_ana', id from public.messages where thread_id = (select id from t_ids where name = 'hilo_ana_pedro');
select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
insert into t_ids values ('m_pedro_ana', public.send_thread_message(
  (select id from t_ids where name = 'hilo_ana_pedro'), '¿Quién eres?'));
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
insert into t_ids values ('hilo_luis_maria', public.start_conversation(
  '60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', false, 'Hola María'));
select pg_temp.logout();
insert into t_ids
select 'm_luis', id from public.messages where thread_id = (select id from t_ids where name = 'hilo_luis_maria');

select results_eq(
  $$ select user_id, title from public.message_push_jobs(array[(select id from t_ids where name = 'm_maria')]) $$,
  $$ values ('00000000-0000-4000-8000-000000000005'::uuid,
             public.chat_alias((select id from t_ids where name = 'hilo_maria_pedro'))) $$,
  'el giver del sorteo llega a Pedro con su alias, nunca con su nombre'
);
select results_eq(
  $$ select user_id, title from public.message_push_jobs(array[(select id from t_ids where name = 'm_pedro')]) $$,
  $$ values ('00000000-0000-4000-8000-000000000004'::uuid, 'Pedro Ruiz'::text) $$,
  'la respuesta de Pedro llega a María con el nombre de Pedro'
);
select results_eq(
  $$ select user_id, title from public.message_push_jobs(array[(select id from t_ids where name = 'm_ana')]) $$,
  $$ values ('00000000-0000-4000-8000-000000000005'::uuid,
             public.chat_alias((select id from t_ids where name = 'hilo_ana_pedro'))) $$,
  'el chat libre anónimo llega con alias'
);
select results_eq(
  $$ select user_id, title from public.message_push_jobs(array[(select id from t_ids where name = 'm_pedro_ana')]) $$,
  $$ values ('00000000-0000-4000-8000-000000000002'::uuid, 'Pedro Ruiz'::text) $$,
  'la respuesta en un chat libre llega a quien lo inició'
);
select results_eq(
  $$ select user_id, title from public.message_push_jobs(array[(select id from t_ids where name = 'm_luis')]) $$,
  $$ values ('00000000-0000-4000-8000-000000000004'::uuid, 'Luis Gómez'::text) $$,
  'el chat libre con nombre llega con el nombre'
);
select is(
  (select count(*) from public.message_push_jobs(array(select id from public.messages)) j
   where j.title in ('María López', 'Ana Pérez'))::int,
  0, 'ningún push revela a quien escribe en secreto'
);
select results_eq(
  $$ select url, tag from public.message_push_jobs(array[(select id from t_ids where name = 'm_pedro')]) $$,
  $$ values ('/mensajes?chat=' || (select id from t_ids where name = 'hilo_maria_pedro'),
             'chat:' || (select id from t_ids where name = 'hilo_maria_pedro')) $$,
  'el push abre la conversación correcta'
);
select is(
  (select count(*) from public.message_push_jobs(array(select id from t_ids where name like 'm\_%')))::int,
  5, 'cada mensaje genera exactamente un push (solo para la otra persona)'
);

-- Quien silenció el chat o está desactivado no recibe push.
insert into public.thread_blocks (thread_id, user_id)
values ((select id from t_ids where name = 'hilo_luis_maria'), '00000000-0000-4000-8000-000000000004');
select is(
  (select count(*) from public.message_push_jobs(array[(select id from t_ids where name = 'm_luis')]))::int,
  0, 'si María silenció el chat, no recibe push'
);
update public.profiles set is_active = false where id = '00000000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.message_push_jobs(array[(select id from t_ids where name = 'm_maria')]))::int,
  0, 'una cuenta desactivada no recibe push'
);
update public.profiles set is_active = true where id = '00000000-0000-4000-8000-000000000005';

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select * from public.message_push_jobs(array[(select id from t_ids where name = 'm_maria')]) $$,
  '42501', null, 'los usuarios no pueden consultar a quién va cada push'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Con push configurado: lo que realmente sale hacia la Edge Function
-- ---------------------------------------------------------------------------
select vault.create_secret('http://127.0.0.1:9/send-push', 'push_function_url');
select vault.create_secret('secreto-de-prueba', 'push_webhook_secret');

select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
select public.send_thread_message((select id from t_ids where name = 'hilo_maria_pedro'), '¿Y la talla?');
select pg_temp.logout();

select is((select count(*) from net.http_request_queue)::int, 1, 'un mensaje encola una petición');
select ok(
  (select convert_from(body, 'utf8')::jsonb #>> '{jobs,0,title}' = public.chat_alias((select id from t_ids where name = 'hilo_maria_pedro'))
      and convert_from(body, 'utf8') not like '%María%'
      and convert_from(body, 'utf8') not like '%00000000-0000-4000-8000-000000000004%'
      and headers ->> 'x-push-secret' = 'secreto-de-prueba'
   from net.http_request_queue),
  'la petición lleva el alias y el secreto, y nada que identifique a María'
);

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select public.send_announcement('Reunión de entrega', 'El viernes a las 5 en la sala grande.');
select pg_temp.logout();
select is(
  (select jsonb_array_length(convert_from(body, 'utf8')::jsonb -> 'jobs') from net.http_request_queue
   order by id desc limit 1),
  (select count(*)::int from public.profiles where is_active),
  'un aviso a todos es una sola petición con un push por persona activa'
);

select * from finish();
rollback;

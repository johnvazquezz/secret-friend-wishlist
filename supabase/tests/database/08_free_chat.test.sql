-- Pruebas del chat libre (pgTAP): escribir a cualquier participante, con nombre o en secreto.
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

-- Usuarios del seed: admin 001, ana 002, luis 003, maria 004, pedro 005, sofia 006, jorge 007
-- Participan ana, luis, maria y pedro. Sorteo: luis → ana → maria → pedro → luis
insert into public.events (id, name, status, created_by) values
  ('50000000-0000-4000-8000-000000000001', 'Chat libre', 'drawn', '00000000-0000-4000-8000-000000000001');
insert into public.event_participants (event_id, user_id, status)
select '50000000-0000-4000-8000-000000000001', id, 'confirmed'
from unnest(array[
  '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'
]::uuid[]) as id;
insert into public.assignments (event_id, giver_id, receiver_id) values
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004'),
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'),
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003');

create temp table t_ids (name text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;

-- ---------------------------------------------------------------------------
-- Antes de publicar: cerrado
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', true, 'Hola') $$,
  'P0001', 'chat_closed', 'antes de publicar no se pueden abrir chats'
);
select pg_temp.logout();

update public.events set status = 'published' where id = '50000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Quién puede escribir a quién
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok(
  $$ select public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', true, 'Hola') $$,
  'P0001', 'not_participant', 'quien no participa no puede escribir'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006', true, 'Hola') $$,
  'P0001', 'not_participant', 'no se puede escribir a quien no participa'
);
select throws_ok(
  $$ select public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', true, 'Hola') $$,
  'P0001', 'cannot_message_self', 'nadie se escribe a sí mismo'
);
select throws_ok(
  $$ select public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', true, '  ') $$,
  'P0001', 'invalid_message', 'el primer mensaje no puede estar vacío'
);

-- Ana (que regala a María) escribe EN SECRETO a Pedro para despistar
insert into t_ids values ('ana_pedro', public.start_conversation(
  '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', true,
  'Te dejé un turrón en tu mesa 🍫'));
select ok((select id from t_ids where name = 'ana_pedro') is not null, 'Ana abre un chat anónimo con Pedro');
select is(
  public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', true, '¿Te gustó?'),
  (select id from t_ids where name = 'ana_pedro'),
  'escribir otra vez en secreto a la misma persona reutiliza el chat'
);
select results_eq(
  $$ select partner_name, my_alias is not null, partner_alias, is_my_recipient
     from public.get_my_conversations('50000000-0000-4000-8000-000000000001')
     where thread_id = (select id from t_ids where name = 'ana_pedro') $$,
  $$ values ('Pedro Ruiz'::text, true, null::text, false) $$,
  'Ana ve a Pedro y el alias con el que escribe'
);
select pg_temp.logout();

-- María (que regala a Pedro) escribe en el hilo del sorteo
select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
select lives_ok(
  $$ select public.send_thread_message(
       (select thread_id from public.get_my_conversations('50000000-0000-4000-8000-000000000001') where is_my_recipient),
       '¡Hola, soy tu amigo secreto!') $$,
  'María escribe a Pedro desde el hilo del sorteo'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Pedro no puede distinguir a su amigo secreto real del chat de despiste
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
select is(
  (select count(*) from public.get_my_conversations('50000000-0000-4000-8000-000000000001') where my_role = 'receiver')::int,
  2, 'Pedro tiene dos chats anónimos: el de su amigo secreto y el de Ana'
);
select is(
  (select count(distinct (my_role, partner_name, partner_avatar_path, my_alias, is_my_recipient,
                          partner_alias is null, blocked_by_me, blocked_by_partner))
   from public.get_my_conversations('50000000-0000-4000-8000-000000000001') where my_role = 'receiver')::int,
  1, 'las dos filas son indistinguibles (salvo el alias, el id y la hora)'
);
select ok(
  (select bool_and(partner_alias is not null and partner_name is null and partner_avatar_path is null)
   from public.get_my_conversations('50000000-0000-4000-8000-000000000001') where my_role = 'receiver'),
  'ninguno revela nombre ni foto, ambos tienen alias'
);
select is(
  (select count(*) from public.get_my_conversations('50000000-0000-4000-8000-000000000001') c
   where c::text ilike '%Ana%' or c::text like '%00000000-0000-4000-8000-000000000002%')::int,
  0, 'nada en la respuesta de Pedro menciona a Ana'
);
select throws_ok($$ select * from public.free_threads $$, '42501', null, 'Pedro no lee free_threads');
select throws_ok($$ select * from public.thread_blocks $$, '42501', null, 'Pedro no lee thread_blocks');
select lives_ok(
  $$ select public.send_thread_message((select id from t_ids where name = 'ana_pedro'), '¿Quién eres? 👀') $$,
  'Pedro responde al chat anónimo'
);
select pg_temp.logout();

-- Luis: el hilo donde le regalan (Pedro → Luis) no tiene mensajes, así que no aparece
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is(
  (select count(*) from public.get_my_conversations('50000000-0000-4000-8000-000000000001') where my_role = 'receiver')::int,
  0, 'un hilo del sorteo sin mensajes no aparece del lado de quien recibe'
);

-- Chat con nombre: la pareja es simétrica
insert into t_ids values ('luis_maria', public.start_conversation(
  '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', false, '¡Hola María! Soy Luis'));
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
select results_eq(
  $$ select partner_name, partner_alias, my_alias
     from public.get_my_conversations('50000000-0000-4000-8000-000000000001')
     where thread_id = (select id from t_ids where name = 'luis_maria') $$,
  $$ values ('Luis Gómez'::text, null::text, null::text) $$,
  'en un chat con nombre, María ve quién le escribe'
);
select is(
  public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', false, '¡Hola Luis!'),
  (select id from t_ids where name = 'luis_maria'),
  'si María escribe con su nombre a Luis, se usa el mismo chat'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Silenciar
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
select lives_ok(
  $$ select public.set_thread_blocked((select id from t_ids where name = 'ana_pedro'), true) $$,
  'Pedro silencia el chat anónimo'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.send_thread_message((select id from t_ids where name = 'ana_pedro'), 'Hola otra vez') $$,
  'P0001', 'thread_blocked', 'Ana ya no puede escribir en ese chat'
);
select is(
  (select blocked_by_partner from public.get_my_conversations('50000000-0000-4000-8000-000000000001')
   where thread_id = (select id from t_ids where name = 'ana_pedro')),
  true, 'Ana ve que el chat está silenciado'
);
select throws_ok(
  $$ select public.set_thread_blocked((select id from t_ids where name = 'luis_maria'), true) $$,
  'P0001', 'no_thread', 'nadie puede silenciar un chat ajeno'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
select lives_ok(
  $$ select public.set_thread_blocked((select id from t_ids where name = 'ana_pedro'), false) $$,
  'Pedro lo reactiva'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.send_thread_message((select id from t_ids where name = 'ana_pedro'), 'Gracias 😊') $$,
  'Ana vuelve a poder escribir'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Admin y límites
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.free_threads $$, '42501', null, 'el ADMIN no lee free_threads');
select is((select count(*) from public.messages)::int, 0, 'el ADMIN no lee ningún mensaje');
select pg_temp.logout();

-- Ana ya abrió 1 chat hoy; se simulan 9 más en otro evento para llegar al límite de 10.
insert into public.events (id, name, status, created_by) values
  ('50000000-0000-4000-8000-000000000002', 'Otro', 'finished', '00000000-0000-4000-8000-000000000001');
insert into public.free_threads (event_id, initiator_id, recipient_id, initiator_anonymous)
select '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', r, a
from unnest(array[
  '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007'
]::uuid[]) as r, unnest(array[true, false]) as a
limit 9;

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.start_conversation('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', true, 'Hola') $$,
  'P0001', 'too_many_conversations', 'máximo 10 chats nuevos al día'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Evento finalizado: solo lectura. Borrado en cascada.
-- ---------------------------------------------------------------------------
update public.events set status = 'finished' where id = '50000000-0000-4000-8000-000000000001';
select pg_temp.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$ select public.send_thread_message((select id from t_ids where name = 'ana_pedro'), 'Hola') $$,
  'P0001', 'chat_closed', 'con el evento finalizado no se escribe'
);
select is(
  (select count(*) from public.get_my_conversations('50000000-0000-4000-8000-000000000001'))::int,
  3, 'pero las conversaciones siguen visibles (2 recibidas + la suya del sorteo)'
);
select pg_temp.logout();

delete from public.free_threads where thread_id = (select id from t_ids where name = 'ana_pedro');
select is(
  (select count(*) from public.messages where thread_id = (select id from t_ids where name = 'ana_pedro'))::int,
  0, 'al borrar un chat se borran sus mensajes'
);

select * from finish();
rollback;

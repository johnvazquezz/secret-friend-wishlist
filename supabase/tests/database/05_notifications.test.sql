-- Pruebas de notificaciones (pgTAP).
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

create function pg_temp.count_kind(p_user uuid, p_kind text) returns integer language sql as $$
  select count(*)::integer from public.notifications where user_id = p_user and kind = p_kind;
$$;

-- admin 001, ana 002, luis 003, maria 004, pedro 005
-- Ana tiene un deseo; los demás no.
insert into public.wishlist_items (user_id, title) values ('00000000-0000-4000-8000-000000000002', 'Libro');

-- Evento con Ana, Luis, María (Pedro no)
insert into public.events (id, name, registration_deadline, exchange_at, created_by)
values ('30000000-0000-4000-8000-000000000001', 'Navidad', now() + interval '1 day',
        now() + interval '2 days 1 hour', '00000000-0000-4000-8000-000000000001');
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
insert into public.event_participants (event_id, user_id) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
select pg_temp.logout();

select is(
  (select count(*) from public.notifications)::int, 0,
  'en borrador no se notifica a nadie'
);

-- Abrir inscripción
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select public.open_event('30000000-0000-4000-8000-000000000001');
insert into public.event_participants (event_id, user_id)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004');
select pg_temp.logout();

select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000002', 'event_open'), 1, 'Ana recibe "arrancó el evento"');
select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000004', 'event_open'), 1, 'María, añadida después, también');
select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000005', 'event_open'), 0, 'Pedro (no participa) no');

-- Recordatorios: dos ejecuciones no duplican
update public.event_participants set status = 'confirmed', responded_at = now()
  where user_id in ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004');
select cmp_ok(public.send_reminders(), '>', 0, 'send_reminders crea recordatorios');
select is(public.send_reminders(), 0, 'una segunda ejecución no duplica nada');
select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000003', 'reminder_registration'), 1, 'Luis (sin responder) recibe recordatorio de inscripción');
select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000002', 'reminder_registration'), 0, 'Ana (ya confirmó) no');
select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000004', 'reminder_wishlist'), 1, 'María (sin deseos) recibe recordatorio de lista');
select is(pg_temp.count_kind('00000000-0000-4000-8000-000000000002', 'reminder_wishlist'), 0, 'Ana (con deseos) no');

-- Sorteo y publicación
update public.event_participants set status = 'confirmed'
  where event_id = '30000000-0000-4000-8000-000000000001';
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select public.run_draw('30000000-0000-4000-8000-000000000001');
select pg_temp.logout();
select is((select count(*) from public.notifications where kind = 'draw_published')::int, 0, 'sortear no notifica (aún no es público)');
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select public.publish_draw('30000000-0000-4000-8000-000000000001');
select pg_temp.logout();
select is((select count(*) from public.notifications where kind = 'draw_published')::int, 3, 'publicar notifica a los 3 participantes');

select public.send_reminders();
select is((select count(*) from public.notifications where kind = 'reminder_exchange')::int, 3, 'recordatorio de intercambio a los 3');

-- Privacidad y permisos
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select is(
  (select count(*) from public.notifications where user_id <> '00000000-0000-4000-8000-000000000002')::int, 0,
  'cada usuario solo ve sus notificaciones'
);
select throws_ok(
  $$ insert into public.notifications (user_id, kind, title) values ('00000000-0000-4000-8000-000000000003', 'x', 'falsa') $$,
  '42501', null, 'nadie crea notificaciones desde el cliente'
);
select public.mark_notifications_read();
select is((select count(*) from public.notifications where read_at is null)::int, 0, 'Ana marca todas como leídas');
select throws_ok(
  $$ select public.send_announcement('Hola', 'x') $$, '42501', 'not_admin',
  'un participante no puede enviar avisos'
);
select pg_temp.logout();
select isnt(
  (select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-000000000003' and read_at is null)::int, 0,
  'marcar como leídas no afecta a otros usuarios'
);

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select cmp_ok(public.send_announcement('Cambio de sala', 'El intercambio será en la terraza.'), '>=', 5,
  'el admin envía un aviso a todos los usuarios activos');
select pg_temp.logout();

select * from finish();
rollback;

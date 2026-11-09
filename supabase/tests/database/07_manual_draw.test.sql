-- Pruebas del sorteo hecho fuera de la app (papelitos).
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

-- Seed: admin 001, ana 002, luis 003, maria 004, pedro 005, sofia 006, jorge 007
-- En la lista: ana, luis, maria (sin responder), pedro (confirmado), jorge (no participa)
insert into public.events (id, name, status, created_by)
values ('30000000-0000-4000-8000-000000000001', 'Papelitos', 'open', '00000000-0000-4000-8000-000000000001');
insert into public.event_participants (event_id, user_id, status) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'invited'),
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'invited'),
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'invited'),
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'confirmed'),
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007', 'declined');

-- ---------------------------------------------------------------------------
-- El admin marca el sorteo como hecho fuera de la app
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.start_manual_event('30000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_admin', 'un participante no puede iniciar el modo papelitos'
);
select throws_ok(
  $$ update public.events set draw_mode = 'manual' where id = '30000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'nadie cambia draw_mode directamente'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select is(
  public.start_manual_event('30000000-0000-4000-8000-000000000001'), 4,
  'el admin inicia el modo papelitos con 4 participantes (Jorge no participa)'
);
select throws_ok(
  $$ select public.start_manual_event('30000000-0000-4000-8000-000000000001') $$,
  'P0001', 'invalid_event_status', 'no se puede iniciar dos veces'
);
select pg_temp.logout();

select results_eq(
  $$ select status::text, draw_mode from public.events where id = '30000000-0000-4000-8000-000000000001' $$,
  $$ values ('published'::text, 'manual'::text) $$,
  'el evento queda publicado en modo manual'
);
select is(
  (select count(*) from public.assignments where event_id = '30000000-0000-4000-8000-000000000001')::int, 0,
  'no se genera ninguna asignación'
);
select is(
  (select count(*) from public.event_participants
   where event_id = '30000000-0000-4000-8000-000000000001' and status = 'confirmed')::int, 4,
  'quien no había respondido queda confirmado'
);
select is(
  (select count(*) from public.notifications where kind = 'manual_claim')::int, 4,
  'los 4 participantes reciben el aviso de registrar a su amigo secreto'
);

-- ---------------------------------------------------------------------------
-- Registro
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000002'); -- ana
select lives_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003') $$,
  'Ana registra a Luis'
);
select is(
  (select full_name from public.get_my_assignment('30000000-0000-4000-8000-000000000001')),
  'Luis Gómez', 'Ana ve a Luis como su destinatario'
);
select throws_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') $$,
  'P0001', 'cannot_claim_self', 'nadie se registra a sí mismo'
);
select throws_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007') $$,
  'P0001', 'recipient_not_participant', 'no se registra a quien no participa'
);
select throws_ok(
  $$ select * from public.assignments $$,
  '42501', null, 'las asignaciones siguen siendo ilegibles'
);
select pg_temp.logout();

select is(
  (select count(*) from public.notifications
   where user_id = '00000000-0000-4000-8000-000000000003' and kind = 'claimed')::int, 1,
  'Luis recibe el aviso de que su amigo secreto ya está en la app'
);

select pg_temp.login_as('00000000-0000-4000-8000-000000000004'); -- maria
select throws_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003') $$,
  'P0001', 'recipient_taken', 'nadie puede registrar a una persona ya registrada'
);
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000007'); -- jorge
select throws_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') $$,
  'P0001', 'not_participant', 'quien no participa no registra a nadie'
);
select pg_temp.logout();

-- Ana se equivocó: cambia a María (aún no hay mensajes)
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004') $$,
  'Ana cambia su registro mientras no haya mensajes'
);
select is(public.can_change_my_claim('30000000-0000-4000-8000-000000000001'), true,
  'Ana todavía puede cambiar');
select pg_temp.logout();

-- María registra a Luis (ya libre) y le escribe
select pg_temp.login_as('00000000-0000-4000-8000-000000000004');
select lives_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003') $$,
  'María registra a Luis, que quedó libre'
);
select lives_ok(
  $$ select public.send_message('30000000-0000-4000-8000-000000000001', 'giver', 'Hola Luis') $$,
  'el chat funciona con el registro manual'
);
select throws_ok(
  $$ select public.claim_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005') $$,
  'P0001', 'claim_locked', 'con mensajes ya no se puede cambiar'
);
select throws_ok(
  $$ select public.release_my_claim('30000000-0000-4000-8000-000000000001') $$,
  'P0001', 'claim_locked', 'con mensajes tampoco se puede deshacer'
);
select is(public.can_change_my_claim('30000000-0000-4000-8000-000000000001'), false,
  'María ya no puede cambiar');
select throws_ok(
  $$ select public.admin_release_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003') $$,
  '42501', 'not_admin', 'un participante no puede liberar registros'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- El admin libera a Luis sin saber quién lo tenía
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.admin_release_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003') $$,
  'el admin libera a Luis'
);
select throws_ok(
  $$ select public.admin_release_recipient('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003') $$,
  'P0001', 'not_claimed', 'no se libera a quien nadie registró'
);
select lives_ok(
  $$ insert into public.event_participants (event_id, user_id)
     values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006') $$,
  'el admin añade tarde a Sofía'
);
select pg_temp.logout();

select ok(
  not exists (
    select 1 from public.assignments
    where event_id = '30000000-0000-4000-8000-000000000001' and receiver_id = '00000000-0000-4000-8000-000000000003'
  )
  and exists (
    select 1 from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000004' and kind = 'claim_released'
  ),
  'el registro de Luis se borra y María recibe el aviso'
);
select ok(
  (select details::text from public.audit_log where action = 'draw.manual_release')
    not like '%00000000-0000-4000-8000-000000000004%',
  'la auditoría no guarda quién tenía a Luis'
);
select is(
  (select status::text from public.event_participants
   where event_id = '30000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000006'),
  'confirmed', 'quien se añade tarde participa directamente'
);
-- Sin registrar: luis, maria (liberada), pedro, sofia
select is(public.send_manual_claim_reminders(), 4,
  'recordatorio a los 4 que aún no registraron a su amigo secreto');

select * from finish();
rollback;

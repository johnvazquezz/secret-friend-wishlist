-- Estadísticas del admin (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into public.events (id, name, status, created_by)
values ('40000000-0000-4000-8000-000000000001', 'Stats', 'published', '00000000-0000-4000-8000-000000000001');
insert into public.event_participants (event_id, user_id, status) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'confirmed'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'confirmed'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'confirmed'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'declined');
insert into public.assignments (event_id, giver_id, receiver_id) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'),
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002');
insert into public.wishlist_items (user_id, title) values ('00000000-0000-4000-8000-000000000002', 'Libro');
insert into public.messages (thread_id, author_role, body)
  select thread_id, 'giver', 'hola' from public.assignments
  where giver_id = '00000000-0000-4000-8000-000000000002';
insert into public.messages (thread_id, author_role, body)
  select thread_id, 'receiver', 'hola!' from public.assignments
  where giver_id = '00000000-0000-4000-8000-000000000002';

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select invited, confirmed, declined, with_wishlist, pending_password, conversations_started, messages_total
     from public.admin_event_stats('40000000-0000-4000-8000-000000000001') $$,
  $$ values (0, 3, 1, 1, 1, 1, 2) $$,
  'el admin ve solo conteos agregados'
);
select is(
  (select count(*) from pg_proc p, unnest(p.proargnames) as arg(name)
   where p.proname = 'admin_event_stats' and arg.name <> 'p_event_id'
     and arg.name ~ '(giver|receiver|user|thread|body)')::int,
  0, 'el resultado no tiene columnas de personas, hilos ni contenido'
);
reset role;

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select * from public.admin_event_stats('40000000-0000-4000-8000-000000000001') $$,
  '42501', 'not_admin', 'un participante no ve las estadísticas'
);

select * from finish();
rollback;

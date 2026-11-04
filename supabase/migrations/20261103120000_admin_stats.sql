-- Fase 7: estadísticas del evento para el admin.
-- Solo conteos agregados: nunca parejas, ni quién escribe a quién, ni contenido de mensajes.
create function public.admin_event_stats(p_event_id uuid)
returns table (
  invited integer,
  confirmed integer,
  declined integer,
  with_wishlist integer,
  with_preferences integer,
  pending_password integer,
  conversations_started integer,
  messages_total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  with p as (
    select ep.user_id, ep.status
    from public.event_participants ep
    where ep.event_id = p_event_id
  )
  select
    (select count(*) from p where status = 'invited')::integer,
    (select count(*) from p where status = 'confirmed')::integer,
    (select count(*) from p where status = 'declined')::integer,
    (select count(*) from p where status <> 'declined'
       and exists (select 1 from public.wishlist_items w where w.user_id = p.user_id))::integer,
    (select count(*) from p where status <> 'declined'
       and exists (select 1 from public.user_preferences up where up.user_id = p.user_id))::integer,
    (select count(*) from p join public.profiles pr on pr.id = p.user_id
       where pr.must_change_password and pr.is_active)::integer,
    (select count(distinct m.thread_id) from public.messages m
       join public.assignments a on a.thread_id = m.thread_id
       where a.event_id = p_event_id)::integer,
    (select count(*) from public.messages m
       join public.assignments a on a.thread_id = m.thread_id
       where a.event_id = p_event_id)::integer;
end;
$$;

revoke execute on function public.admin_event_stats(uuid) from public, anon;
grant execute on function public.admin_event_stats(uuid) to authenticated;

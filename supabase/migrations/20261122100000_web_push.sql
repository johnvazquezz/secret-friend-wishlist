-- Notificaciones push reales (Web Push con VAPID).
--
-- Flujo: INSERT en messages / notifications → trigger (por sentencia) → pg_net → Edge Function
-- send-push → servicio push del navegador (FCM, Mozilla, Apple, Windows) → service worker.
--
-- Privacidad:
--   * Quién recibe y qué título lleva (nombre o alias) se decide AQUÍ, con la misma regla que
--     get_my_conversations: quien escribe en secreto (giver del sorteo o chat libre anónimo)
--     aparece siempre con su alias. La Edge Function no tiene lógica de identidades.
--   * Nadie (tampoco el admin) puede leer las suscripciones de otra persona.
--
-- Configuración (solo en el servidor, nunca en el repositorio): la URL de la función y el secreto
-- compartido se leen de Vault. Si no están, los triggers no hacen nada (local, CI, pgTAP).
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Suscripciones (una por navegador/dispositivo)
-- ---------------------------------------------------------------------------
-- Servicios push conocidos: evita que la Edge Function haga peticiones a URLs arbitrarias.
create function public.is_valid_push_subscription(p_subscription jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (p_subscription ->> 'endpoint') ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/'
    and char_length(p_subscription ->> 'endpoint') <= 1000
    and coalesce(p_subscription -> 'keys' ->> 'p256dh', '') ~ '^[A-Za-z0-9_=-]{20,200}$'
    and coalesce(p_subscription -> 'keys' ->> 'auth', '') ~ '^[A-Za-z0-9_=-]{8,100}$',
    false
  );
$$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription jsonb not null check (public.is_valid_push_subscription(subscription)),
  endpoint text generated always as (subscription ->> 'endpoint') stored,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;

create policy "Users read own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users delete own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Guarda (o renueva) la suscripción de este navegador para el usuario actual. Si el navegador
-- era de otra persona (PC compartida), la suscripción pasa a ser del usuario actual.
create function public.register_push_subscription(
  p_subscription jsonb,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_sub jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Solo lo necesario para enviar (se descartan expirationTime y otros campos).
  v_sub := jsonb_build_object(
    'endpoint', p_subscription ->> 'endpoint',
    'keys', jsonb_build_object(
      'p256dh', p_subscription -> 'keys' ->> 'p256dh',
      'auth', p_subscription -> 'keys' ->> 'auth'
    )
  );
  if not public.is_valid_push_subscription(v_sub) then
    raise exception 'invalid_subscription' using errcode = 'P0001';
  end if;

  insert into public.push_subscriptions (user_id, subscription, user_agent)
  values (v_me, v_sub, left(nullif(trim(p_user_agent), ''), 400))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        user_agent = excluded.user_agent,
        created_at = now();

  -- Como mucho 10 dispositivos por persona: se quitan los más antiguos.
  delete from public.push_subscriptions
  where user_id = v_me
    and id not in (
      select id from public.push_subscriptions
      where user_id = v_me
      order by created_at desc
      limit 10
    );
end;
$$;

revoke execute on function public.register_push_subscription(jsonb, text) from public, anon;
grant execute on function public.register_push_subscription(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Qué push genera cada mensaje de chat (interna: solo la usan los triggers)
-- ---------------------------------------------------------------------------
-- Para cada mensaje: la OTRA persona del hilo (nunca el autor), si está activa y no silenció el
-- chat. Título: nombre del autor, o su alias si escribe en secreto para quien recibe.
create function public.message_push_jobs(p_message_ids uuid[])
returns table (
  user_id uuid,
  title text,
  body text,
  url text,
  tag text,
  thread_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with msg as (
    select m.id, m.thread_id, m.author_role, m.body, m.created_at
    from public.messages m
    where m.id = any (p_message_ids)
  ),
  target as (
    -- Sorteo: el giver escribe siempre en secreto; el receiver, con su nombre (el giver ya lo conoce).
    select msg.thread_id, msg.body, msg.created_at,
      case when msg.author_role = 'giver' then a.receiver_id else a.giver_id end as recipient_id,
      case when msg.author_role = 'giver' then a.giver_id else a.receiver_id end as author_id,
      msg.author_role = 'giver' as author_hidden
    from msg
    join public.assignments a on a.thread_id = msg.thread_id
    union all
    -- Libre: quien inicia ('giver') puede ser anónimo; quien recibe responde con su nombre.
    select msg.thread_id, msg.body, msg.created_at,
      case when msg.author_role = 'giver' then f.recipient_id else f.initiator_id end,
      case when msg.author_role = 'giver' then f.initiator_id else f.recipient_id end,
      msg.author_role = 'giver' and f.initiator_anonymous
    from msg
    join public.free_threads f on f.thread_id = msg.thread_id
  )
  select
    t.recipient_id,
    case when t.author_hidden then public.chat_alias(t.thread_id) else author.full_name end,
    case when char_length(t.body) > 120 then left(t.body, 119) || '…' else t.body end,
    '/mensajes?chat=' || t.thread_id,
    'chat:' || t.thread_id,
    t.thread_id
  from target t
  join public.profiles recipient on recipient.id = t.recipient_id and recipient.is_active
  join public.profiles author on author.id = t.author_id
  where t.recipient_id <> t.author_id
    and not exists (
      select 1 from public.thread_blocks b
      where b.thread_id = t.thread_id and b.user_id = t.recipient_id
    )
  order by t.created_at;
$$;

revoke execute on function public.message_push_jobs(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Envío a la Edge Function (asíncrono: pg_net manda la petición tras el COMMIT)
-- ---------------------------------------------------------------------------
create function public.enqueue_push(p_jobs jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_jobs is null or jsonb_array_length(p_jobs) = 0 then
    return;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return; -- push sin configurar en este entorno
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('jobs', p_jobs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 10000
  );
exception when others then
  -- Un fallo del push nunca debe impedir guardar el mensaje o el aviso.
  raise warning 'enqueue_push: %', sqlerrm;
end;
$$;

revoke execute on function public.enqueue_push(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers por sentencia: un aviso a 100 personas = una sola petición HTTP
-- ---------------------------------------------------------------------------
create function public.on_messages_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_push((
    select jsonb_agg(jsonb_build_object(
      'user_id', j.user_id,
      'kind', 'chat',
      'title', j.title,
      'body', j.body,
      'url', j.url,
      'tag', j.tag,
      'thread_id', j.thread_id
    ))
    from public.message_push_jobs(array(select n.id from new_rows n)) j
  ));
  return null;
exception when others then
  raise warning 'on_messages_push: %', sqlerrm;
  return null;
end;
$$;

create function public.on_notifications_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_push((
    select jsonb_agg(jsonb_build_object(
      'user_id', n.user_id,
      'kind', 'notification',
      'title', n.title,
      'body', case when char_length(coalesce(n.body, '')) > 180
                   then left(n.body, 179) || '…' else coalesce(n.body, '') end,
      'url', coalesce(n.link, '/'),
      'tag', 'notif:' || n.id
    ) order by n.created_at)
    from new_rows n
    join public.profiles p on p.id = n.user_id and p.is_active
  ));
  return null;
exception when others then
  raise warning 'on_notifications_push: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.on_messages_push() from public, anon, authenticated;
revoke execute on function public.on_notifications_push() from public, anon, authenticated;

create trigger messages_push
  after insert on public.messages
  referencing new table as new_rows
  for each statement execute function public.on_messages_push();

create trigger notifications_push
  after insert on public.notifications
  referencing new table as new_rows
  for each statement execute function public.on_notifications_push();

-- Fase 4: lista de deseos y gustos personales.
--
-- Visibilidad:
--   * wishlist_items: la ven todos los usuarios autenticados (como la antigua página de deseos);
--     no revela nada del sorteo. Solo el dueño la modifica.
--   * user_preferences (tallas, alergias, lo que no le gusta…): solo la ve el propio usuario y, tras
--     publicar el sorteo, la persona que le regala, mediante get_my_recipient_preferences().
--
-- La tabla team_members queda obsoleta (la app ya no la usa). No se borra para conservar los datos.

-- ---------------------------------------------------------------------------
-- Lista de deseos
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://[^\s]+$')),
  notes text check (notes is null or char_length(notes) <= 500),
  price_hint numeric(10, 2) check (price_hint is null or price_hint >= 0),
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 = me encantaría
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishlist_items_user_idx on public.wishlist_items (user_id, position);

create trigger wishlist_items_set_updated_at
  before update on public.wishlist_items
  for each row execute function public.set_updated_at();

-- Máximo 20 deseos por persona.
create function public.enforce_wishlist_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist_items where user_id = new.user_id) >= 20 then
    raise exception 'wishlist_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger wishlist_items_limit
  before insert on public.wishlist_items
  for each row execute function public.enforce_wishlist_limit();

alter table public.wishlist_items enable row level security;
revoke all on table public.wishlist_items from anon, authenticated;
grant select, delete on table public.wishlist_items to authenticated;
grant insert (title, url, notes, price_hint, priority, position) on table public.wishlist_items to authenticated;
grant update (title, url, notes, price_hint, priority, position) on table public.wishlist_items to authenticated;

create policy "Authenticated users read wishlists"
  on public.wishlist_items for select to authenticated
  using (true);

create policy "Users add own wishes"
  on public.wishlist_items for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users edit own wishes"
  on public.wishlist_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete own wishes"
  on public.wishlist_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Gustos personales
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  likes text check (likes is null or char_length(likes) <= 1000),
  dislikes text check (dislikes is null or char_length(dislikes) <= 1000),
  sizes text check (sizes is null or char_length(sizes) <= 300),
  allergies text check (allergies is null or char_length(allergies) <= 300),
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from anon, authenticated;
grant select on table public.user_preferences to authenticated;
grant insert (likes, dislikes, sizes, allergies, notes) on table public.user_preferences to authenticated;
grant update (likes, dislikes, sizes, allergies, notes) on table public.user_preferences to authenticated;

create policy "Users read own preferences"
  on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users create own preferences"
  on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users update own preferences"
  on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Gustos de mi destinatario (solo tras publicar el sorteo). Nunca expone datos de quien me regala.
create function public.get_my_recipient_preferences(p_event_id uuid)
returns table (likes text, dislikes text, sizes text, allergies text, notes text)
language sql
stable
security definer
set search_path = ''
as $$
  select up.likes, up.dislikes, up.sizes, up.allergies, up.notes
  from public.assignments a
  join public.events e on e.id = a.event_id
  join public.user_preferences up on up.user_id = a.receiver_id
  where a.event_id = p_event_id
    and a.giver_id = (select auth.uid())
    and e.status in ('published', 'finished');
$$;

revoke execute on function public.get_my_recipient_preferences(uuid) from public, anon;
grant execute on function public.get_my_recipient_preferences(uuid) to authenticated;

comment on table public.team_members is
  'OBSOLETA desde la Fase 4: reemplazada por wishlist_items. Se conserva solo como histórico.';

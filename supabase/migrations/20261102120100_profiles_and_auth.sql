-- Fase 2: perfiles, roles, auditoría y fotos de perfil.
--
-- Modelo de acceso:
--   * No hay registro público (config: enable_signup = false). El admin crea las cuentas desde la
--     Edge Function admin-users (service_role).
--   * Cada auth.users tiene un public.profiles creado por trigger.
--   * Los clientes solo pueden modificar columnas "inofensivas" de su propio perfil
--     (privilegios por columna). role, email, is_active y must_change_password solo se cambian
--     con service_role (Edge Function) o con funciones SECURITY DEFINER acotadas.

-- ---------------------------------------------------------------------------
-- Tipos y tablas
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('participant', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  department text check (department is null or char_length(department) <= 120),
  avatar_path text check (avatar_path is null or avatar_path = id::text || '/avatar.webp'),
  role public.app_role not null default 'participant',
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.must_change_password is
  'true mientras el usuario tenga la contraseña temporal asignada por el admin.';

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

-- ¿El usuario actual es un admin activo? SECURITY DEFINER para poder usarla dentro de políticas RLS
-- sin recursión sobre profiles.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Crea el perfil al dar de alta un usuario en Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, department)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'department'), '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- El usuario confirma que ya cambió su contraseña temporal.
-- Nota: es una ayuda de UX (forzar el cambio en el primer acceso), no una barrera de seguridad.
create function public.complete_password_change()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set must_change_password = false
  where id = (select auth.uid());
$$;

revoke execute on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, department, avatar_path) on table public.profiles to authenticated;
grant select on table public.audit_log to authenticated;

-- Directorio de la empresa: cualquier empleado autenticado ve los perfiles.
create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "Users update own profile, admins any"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins read audit log"
  on public.audit_log
  for select
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage: fotos de perfil (bucket privado, se sirven con URLs firmadas)
-- Ruta obligatoria: avatars/{user_id}/avatar.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Authenticated users read avatars"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "Users upload own avatar, admins any"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "Users replace own avatar, admins any"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  )
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "Users delete own avatar, admins any"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

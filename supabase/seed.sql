-- Datos de ejemplo SOLO para desarrollo local (`npm run db:reset`).
-- Nunca se aplican en staging/producción.
--
-- Usuarios locales (contraseña para todos: Amigo2026local):
--   admin@local.test  → admin
--   ana@local.test    → participante
--   luis@local.test   → participante (con contraseña temporal: se le obliga a cambiarla)

insert into team_members (name, access_code, wishes) values
  ('Ana Pérez',   'local-demo-1', 'Un libro de cocina'),
  ('Luis Gómez',  'local-demo-2', 'Audífonos inalámbricos'),
  ('María López', 'local-demo-3', '');

do $$
declare
  u record;
begin
  for u in
    select *
    from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@local.test', 'Admin Local', 'Talento Humano'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'ana@local.test',   'Ana Pérez',   'Finanzas'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'luis@local.test',  'Luis Gómez',  'Operaciones')
    ) as t (id, email, full_name, department)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Amigo2026local', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.full_name, 'department', u.department),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    );
  end loop;
end;
$$;

update public.profiles
set role = 'admin', must_change_password = false
where email = 'admin@local.test';

update public.profiles
set must_change_password = false
where email = 'ana@local.test';

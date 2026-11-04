-- Fase 0 en el repositorio: cierra la exposición de team_members.
--
-- Antes: cualquiera con la anon key podía leer todos los access_code y modificar cualquier fila
-- (políticas SELECT/UPDATE con USING (true)).
-- Ahora: solo usuarios autenticados pueden leer, y solo columnas no sensibles. Nadie escribe desde
-- el cliente. La tabla queda en solo lectura hasta que la wishlist la reemplace (Fase 4).

drop policy if exists "Anyone can view team members" on public.team_members;
drop policy if exists "Members can update own card" on public.team_members;
drop policy if exists "Anyone can add a team member" on public.team_members;

revoke all on table public.team_members from anon, authenticated;

-- Privilegios por columna: access_code no es legible por ningún rol de cliente.
grant select (id, name, wishes, created_at, updated_at) on table public.team_members to authenticated;

create policy "Authenticated users can read team members"
  on public.team_members
  for select
  to authenticated
  using (true);

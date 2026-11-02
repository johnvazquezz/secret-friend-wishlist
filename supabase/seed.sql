-- Datos de ejemplo SOLO para desarrollo local (`npm run db:reset`).
-- Nunca se aplican en staging/producción.
insert into team_members (name, access_code, wishes) values
  ('Ana Pérez',   'local-demo-1', 'Un libro de cocina'),
  ('Luis Gómez',  'local-demo-2', 'Audífonos inalámbricos'),
  ('María López', 'local-demo-3', '');

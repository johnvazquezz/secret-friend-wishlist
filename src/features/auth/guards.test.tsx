import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { makeAuth, makeProfile, renderRoutes } from '../../test/utils';

vi.mock('../event/api', () => ({ fetchActiveEvent: vi.fn().mockResolvedValue(null) }));

describe('guards de rutas', () => {
  it('sin sesión redirige al login', async () => {
    const { router } = renderRoutes(routes, '/perfil', makeAuth({ profile: null }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('con contraseña temporal obliga a cambiarla', async () => {
    const auth = makeAuth({ profile: makeProfile({ must_change_password: true }) });
    const { router } = renderRoutes(routes, '/', auth);
    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(screen.getByText(/contraseña temporal/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cambiar-contrasena');
  });

  it('un participante no entra al panel de admin ni ve el enlace', async () => {
    const { router } = renderRoutes(routes, '/admin/usuarios');
    expect(await screen.findByText(/no hay un Amigo Secreto en marcha/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('un admin ve el enlace al panel de usuarios', async () => {
    const auth = makeAuth({ profile: makeProfile({ role: 'admin' }) });
    renderRoutes(routes, '/', auth);
    expect(await screen.findByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('una cuenta desactivada no accede', async () => {
    const auth = makeAuth({ profile: makeProfile({ is_active: false }) });
    renderRoutes(routes, '/', auth);
    expect(await screen.findByRole('alert')).toHaveTextContent('no está activa');
  });

  it('con sesión, /login redirige al inicio', async () => {
    const { router } = renderRoutes(routes, '/login');
    expect(await screen.findByText(/no hay un Amigo Secreto en marcha/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { renderRoutes } from '../../test/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  subscribeToNotifications,
  type Notification,
} from './api';

vi.mock('../event/api', () => ({ fetchActiveEvent: vi.fn().mockResolvedValue(null) }));

const n = (id: string, title: string, read: boolean, link: string | null = '/'): Notification => ({
  id,
  user_id: 'user-1',
  kind: id === 'a' ? 'announcement' : 'draw_published',
  title,
  body: null,
  link,
  dedupe_key: null,
  created_at: '2026-12-01T10:00:00Z',
  read_at: read ? '2026-12-01T11:00:00Z' : null,
});

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(fetchNotifications).mockResolvedValue([
      n('p', '¡Ya puedes ver a quién le regalas! 🎁', false),
      n('a', 'Cambio de sala', false, '/mi-lista'),
      n('o', 'Antigua', true),
    ]);
    vi.mocked(markAllNotificationsRead).mockClear();
  });

  it('muestra el número de no leídas y las marca al abrir', async () => {
    renderRoutes(routes, '/');
    const bell = await screen.findByRole('button', { name: 'Notificaciones (2 sin leer)' });
    await userEvent.click(bell);
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toBeInTheDocument();
    expect(screen.getByText('Cambio de sala')).toBeInTheDocument();
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('navega al enlace de la notificación y se cierra', async () => {
    const { router } = renderRoutes(routes, '/');
    await userEvent.click(await screen.findByRole('button', { name: /Notificaciones/ }));
    await userEvent.click(screen.getByText('Cambio de sala'));
    // La ruta se carga bajo demanda: la navegación termina después del clic
    await waitFor(() => expect(router.state.location.pathname).toBe('/mi-lista'));
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
  });

  it('se cierra con Esc', async () => {
    renderRoutes(routes, '/');
    await userEvent.click(await screen.findByRole('button', { name: /Notificaciones/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
  });

  it('se suscribe en tiempo real a las notificaciones del usuario', async () => {
    renderRoutes(routes, '/');
    await screen.findByRole('button', { name: /Notificaciones/ });
    expect(subscribeToNotifications).toHaveBeenCalledWith('user-1', expect.any(Function));
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { renderRoutes } from '../../test/utils';

vi.mock('../event/api', () => ({ fetchActiveEvent: vi.fn().mockResolvedValue(null) }));

vi.mock('../profile/api', async (importOriginal) => {
  const { makeProfile } = await import('../../test/utils');
  return {
    ...(await importOriginal<typeof import('../profile/api')>()),
    fetchProfiles: vi
      .fn()
      .mockResolvedValue([
        makeProfile({ id: 'user-1', full_name: 'Ana Pérez', department: 'Finanzas' }),
        makeProfile({ id: 'user-2', full_name: 'Luis Gómez', department: 'Operaciones' }),
        makeProfile({ id: 'user-3', full_name: 'Inactivo', is_active: false }),
      ]),
  };
});

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchAllWishlists: vi.fn().mockResolvedValue({
    'user-2': [
      {
        id: 'w1',
        user_id: 'user-2',
        title: 'Audífonos',
        url: null,
        notes: null,
        price_hint: null,
        priority: 1,
        position: 0,
        created_at: '2026-11-01T00:00:00Z',
        updated_at: '2026-11-01T00:00:00Z',
      },
    ],
  }),
}));

describe('WishesPage', () => {
  it('muestra los deseos de las personas activas, primero quien tiene deseos', async () => {
    renderRoutes(routes, '/deseos');
    expect(await screen.findByText('Audífonos')).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(['Luis Gómez', 'Ana Pérez (tú)']);
    expect(screen.getByText(/1 de 2 personas/)).toBeInTheDocument();
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
  });

  it('filtra por nombre o departamento', async () => {
    renderRoutes(routes, '/deseos');
    await userEvent.type(await screen.findByLabelText('Buscar persona'), 'finanzas');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Ana Pérez (tú)',
    ]);
  });
});

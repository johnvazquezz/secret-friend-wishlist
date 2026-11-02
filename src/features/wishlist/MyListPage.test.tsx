import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { renderRoutes } from '../../test/utils';
import {
  createWishlistItem,
  fetchMyPreferences,
  fetchWishlist,
  reorderWishlist,
  savePreferences,
  type WishlistItem,
} from './api';

vi.mock('../event/api', () => ({ fetchActiveEvent: vi.fn().mockResolvedValue(null) }));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchWishlist: vi.fn(),
  fetchMyPreferences: vi.fn(),
  createWishlistItem: vi.fn(),
  reorderWishlist: vi.fn(),
  savePreferences: vi.fn(),
}));

const mocks = {
  wishlist: vi.mocked(fetchWishlist),
  preferences: vi.mocked(fetchMyPreferences),
  create: vi.mocked(createWishlistItem),
  reorder: vi.mocked(reorderWishlist),
  save: vi.mocked(savePreferences),
};

function item(id: string, title: string, position: number): WishlistItem {
  return {
    id,
    user_id: 'user-1',
    title,
    url: null,
    notes: null,
    price_hint: null,
    priority: 2,
    position,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}

describe('MyListPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.preferences.mockResolvedValue(null);
  });

  it('con la lista vacía muestra el formulario y añade un deseo', async () => {
    mocks.wishlist.mockResolvedValue([]);
    mocks.create.mockResolvedValue();
    renderRoutes(routes, '/mi-lista');

    await userEvent.type(await screen.findByLabelText('¿Qué te gustaría?'), 'Audífonos');
    await userEvent.type(screen.getByLabelText('Enlace (opcional)'), 'https://tienda.com/a');
    await userEvent.selectOptions(screen.getByLabelText('Prioridad'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir a mi lista' }));

    expect(mocks.create).toHaveBeenCalledWith(
      {
        title: 'Audífonos',
        url: 'https://tienda.com/a',
        notes: null,
        price_hint: null,
        priority: 1,
      },
      0,
    );
  });

  it('valida enlaces inseguros sin llamar al servidor', async () => {
    mocks.wishlist.mockResolvedValue([]);
    renderRoutes(routes, '/mi-lista');
    await userEvent.type(await screen.findByLabelText('¿Qué te gustaría?'), 'X');
    await userEvent.type(screen.getByLabelText('Enlace (opcional)'), 'javascript:alert(1)');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir a mi lista' }));
    expect(screen.getByRole('alert')).toHaveTextContent('https://');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('reordena los deseos', async () => {
    mocks.wishlist.mockResolvedValue([item('a', 'Libro', 0), item('b', 'Taza', 1)]);
    mocks.reorder.mockResolvedValue();
    renderRoutes(routes, '/mi-lista');

    await userEvent.click(await screen.findByRole('button', { name: 'Subir "Taza"' }));
    expect(mocks.reorder).toHaveBeenCalledWith(['b', 'a']);
    expect(screen.getByRole('button', { name: 'Subir "Libro"' })).toBeDisabled();
  });

  it('guarda los gustos', async () => {
    mocks.wishlist.mockResolvedValue([item('a', 'Libro', 0)]);
    mocks.save.mockResolvedValue();
    renderRoutes(routes, '/mi-lista');

    await userEvent.type(await screen.findByLabelText('Me gusta'), 'Café');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar mis gustos' }));
    expect(mocks.save).toHaveBeenCalledWith({
      likes: 'Café',
      dislikes: null,
      sizes: null,
      allergies: null,
      notes: null,
    });
    expect(await screen.findByText('Gustos guardados.')).toBeInTheDocument();
  });
});

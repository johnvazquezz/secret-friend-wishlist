import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { renderRoutes } from '../../test/utils';
import { fetchMembers, type Member } from './api';

vi.mock('./api', () => ({ fetchMembers: vi.fn() }));
const fetchMembersMock = vi.mocked(fetchMembers);

const members: Member[] = [
  { id: '1', name: 'Ana', wishes: 'Un libro' },
  { id: '2', name: 'Luis', wishes: '' },
];

describe('MembersPage', () => {
  beforeEach(() => {
    fetchMembersMock.mockReset();
  });

  it('muestra las tarjetas de los miembros', async () => {
    fetchMembersMock.mockResolvedValue(members);
    renderRoutes(routes, '/deseos');

    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByText('Un libro')).toBeInTheDocument();
    expect(screen.getByText('Sin deseos especificados aún')).toBeInTheDocument();
    expect(screen.getByText('2 miembros del equipo')).toBeInTheDocument();
  });

  it('muestra el estado vacío', async () => {
    fetchMembersMock.mockResolvedValue([]);
    renderRoutes(routes, '/deseos');

    expect(await screen.findByText('No hay miembros aún.')).toBeInTheDocument();
  });

  it('distingue un error de carga del estado vacío y permite reintentar', async () => {
    fetchMembersMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(members);
    renderRoutes(routes, '/deseos');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar');
    expect(screen.queryByText('No hay miembros aún.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
  });

  it('muestra 404 en rutas desconocidas', async () => {
    renderRoutes(routes, '/no-existe');
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
  });
});

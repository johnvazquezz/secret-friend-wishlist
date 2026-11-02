import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { makeAuth, makeProfile, renderRoutes } from '../../test/utils';
import {
  fetchActiveEvent,
  fetchMyAssignment,
  fetchMyParticipation,
  respondParticipation,
  type EventRow,
} from './api';

vi.mock('../wishlist/api', () => ({
  fetchWishlist: vi.fn().mockResolvedValue([
    {
      id: 'w1',
      user_id: 'user-2',
      title: 'Taza de café',
      url: 'https://tienda.com/taza',
      notes: null,
      price_hint: 10,
      priority: 1,
      position: 0,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ]),
  fetchRecipientPreferences: vi.fn().mockResolvedValue({
    likes: 'Café',
    dislikes: null,
    sizes: 'M',
    allergies: null,
    notes: null,
  }),
}));

vi.mock('./api', () => ({
  fetchActiveEvent: vi.fn(),
  fetchMyParticipation: vi.fn(),
  fetchMyAssignment: vi.fn(),
  respondParticipation: vi.fn(),
}));

const mocks = {
  event: vi.mocked(fetchActiveEvent),
  participation: vi.mocked(fetchMyParticipation),
  assignment: vi.mocked(fetchMyAssignment),
  respond: vi.mocked(respondParticipation),
};

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'event-1',
    name: 'Navidad 2026',
    description: '¡Bienvenidos!',
    rules: 'Regalo envuelto',
    budget_amount: 25,
    currency: 'USD',
    location: 'Sala grande',
    registration_deadline: null,
    exchange_at: '2099-12-19T18:00:00Z',
    status: 'open',
    drawn_at: null,
    published_at: null,
    created_by: 'admin',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
  });

  it('sin evento muestra un mensaje de espera', async () => {
    mocks.event.mockResolvedValue(null);
    renderRoutes(routes, '/');
    expect(await screen.findByText(/no hay un Amigo Secreto en marcha/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /crear el evento/i })).not.toBeInTheDocument();
  });

  it('al admin le ofrece crear el evento', async () => {
    mocks.event.mockResolvedValue(null);
    renderRoutes(routes, '/', makeAuth({ profile: makeProfile({ role: 'admin' }) }));
    expect(await screen.findByRole('link', { name: 'Crear el evento' })).toHaveAttribute(
      'href',
      '/admin/evento',
    );
  });

  it('muestra la información del evento y permite confirmar la participación', async () => {
    mocks.event.mockResolvedValue(makeEvent());
    mocks.participation.mockResolvedValue('invited');
    mocks.respond.mockResolvedValue();
    renderRoutes(routes, '/');

    expect(await screen.findByRole('heading', { name: 'Navidad 2026' })).toBeInTheDocument();
    expect(screen.getByText('Sala grande')).toBeInTheDocument();
    expect(screen.getByText('Regalo envuelto')).toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta regresiva para el intercambio')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '¡Participo!' }));
    expect(mocks.respond).toHaveBeenCalledWith('event-1', true);
  });

  it('avisa a quien no está en la lista', async () => {
    mocks.event.mockResolvedValue(makeEvent());
    mocks.participation.mockResolvedValue(null);
    renderRoutes(routes, '/');
    expect(await screen.findByText(/No estás en la lista/)).toBeInTheDocument();
  });

  it('antes de publicar no pide la asignación', async () => {
    mocks.event.mockResolvedValue(makeEvent({ status: 'drawn' }));
    mocks.participation.mockResolvedValue('confirmed');
    renderRoutes(routes, '/');
    expect(await screen.findByText(/El sorteo ya se hizo/)).toBeInTheDocument();
    expect(mocks.assignment).not.toHaveBeenCalled();
  });

  it('tras publicar muestra al amigo secreto solo al pulsar "Mostrar"', async () => {
    mocks.event.mockResolvedValue(makeEvent({ status: 'published' }));
    mocks.participation.mockResolvedValue('confirmed');
    mocks.assignment.mockResolvedValue({
      receiver_id: 'user-2',
      full_name: 'Luis Gómez',
      department: 'Operaciones',
      avatar_path: null,
    });
    renderRoutes(routes, '/');

    const button = await screen.findByRole('button', { name: 'Mostrar a quién le regalo' });
    expect(screen.queryByText('Luis Gómez')).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.getByText('Luis Gómez')).toBeInTheDocument();
    expect(mocks.assignment).toHaveBeenCalledWith('event-1');
    expect(await screen.findByText('Taza de café')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'tienda.com' })).toHaveAttribute(
      'rel',
      'noopener noreferrer nofollow',
    );
    expect(screen.getByText('Café')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByText('Luis Gómez')).not.toBeInTheDocument();
  });
});

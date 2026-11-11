import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { makeAuth, makeProfile, renderRoutes } from '../../test/utils';
import {
  claimRecipient,
  fetchActiveEvent,
  fetchCanChangeMyClaim,
  fetchMyAssignment,
  fetchMyParticipation,
  fetchParticipants,
  releaseMyClaim,
  respondParticipation,
  type EventRow,
  type Participant,
} from './api';

vi.mock('../chat/api', () => ({
  fetchConversations: vi.fn().mockResolvedValue([]),
  subscribeToMyMessages: vi.fn(() => () => {}),
}));

vi.mock('../wishlist/api', () => ({
  fetchWishlist: vi.fn().mockResolvedValue([
    {
      id: 'w1',
      user_id: 'user-2',
      title: 'Taza de café',
      notes: null,
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
  fetchParticipants: vi.fn(),
  claimRecipient: vi.fn(),
  releaseMyClaim: vi.fn(),
  fetchCanChangeMyClaim: vi.fn(),
}));

const mocks = {
  event: vi.mocked(fetchActiveEvent),
  participation: vi.mocked(fetchMyParticipation),
  assignment: vi.mocked(fetchMyAssignment),
  respond: vi.mocked(respondParticipation),
  participants: vi.mocked(fetchParticipants),
  claim: vi.mocked(claimRecipient),
  release: vi.mocked(releaseMyClaim),
  canChange: vi.mocked(fetchCanChangeMyClaim),
};

const person = (id: string, name: string, status: Participant['status'] = 'confirmed') => ({
  user_id: id,
  status,
  responded_at: null,
  profile: {
    full_name: name,
    email: `${id}@x.com`,
    department: null,
    avatar_path: null,
    is_active: true,
  },
});

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
    draw_mode: 'app',
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
    expect(screen.getByText('Café')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByText('Luis Gómez')).not.toBeInTheDocument();
  });

  describe('sorteo con papelitos', () => {
    const manual = () => makeEvent({ status: 'published', draw_mode: 'manual' });

    it('pide registrar al amigo secreto, sin ofrecerse a uno mismo ni a quien no participa', async () => {
      mocks.event.mockResolvedValue(manual());
      mocks.participation.mockResolvedValue('confirmed');
      mocks.assignment.mockResolvedValue(null);
      mocks.participants.mockResolvedValue([
        person('user-1', 'Yo Mismo'),
        person('user-2', 'Luis Gómez'),
        person('user-3', 'Jorge Ruiz', 'declined'),
      ]);
      mocks.claim.mockResolvedValue();
      renderRoutes(routes, '/');

      const select = await screen.findByLabelText('Persona de tu papelito');
      const options = screen.getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['Elegir persona…', 'Luis Gómez']);

      await userEvent.selectOptions(select, 'user-2');
      await userEvent.click(screen.getByRole('button', { name: 'Registrar' }));
      const dialog = screen.getByRole('alertdialog', { name: '¿Tu papelito dice Luis Gómez?' });
      expect(mocks.claim).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, registrar' }));
      expect(mocks.claim).toHaveBeenCalledWith('event-1', 'user-2');
    });

    it('si la persona ya está registrada lo explica sin decir por quién', async () => {
      mocks.event.mockResolvedValue(manual());
      mocks.participation.mockResolvedValue('confirmed');
      mocks.assignment.mockResolvedValue(null);
      mocks.participants.mockResolvedValue([person('user-2', 'Luis Gómez')]);
      mocks.claim.mockRejectedValue({ message: 'recipient_taken', code: 'P0001' });
      renderRoutes(routes, '/');

      await userEvent.selectOptions(
        await screen.findByLabelText('Persona de tu papelito'),
        'user-2',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Registrar' }));
      await userEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Esa persona ya está registrada por otro participante',
      );
    });

    it('permite deshacer el registro mientras no haya mensajes', async () => {
      mocks.event.mockResolvedValue(manual());
      mocks.participation.mockResolvedValue('confirmed');
      mocks.assignment.mockResolvedValue({
        receiver_id: 'user-2',
        full_name: 'Luis Gómez',
        department: null,
        avatar_path: null,
      });
      mocks.canChange.mockResolvedValue(true);
      mocks.release.mockResolvedValue();
      renderRoutes(routes, '/');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mostrar a quién le regalo' }),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Me equivoqué de persona' }));
      await userEvent.click(screen.getByRole('button', { name: 'Anular registro' }));
      expect(mocks.release).toHaveBeenCalledWith('event-1');
    });

    it('con mensajes ya no ofrece cambiar', async () => {
      mocks.event.mockResolvedValue(manual());
      mocks.participation.mockResolvedValue('confirmed');
      mocks.assignment.mockResolvedValue({
        receiver_id: 'user-2',
        full_name: 'Luis Gómez',
        department: null,
        avatar_path: null,
      });
      mocks.canChange.mockResolvedValue(false);
      renderRoutes(routes, '/');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Mostrar a quién le regalo' }),
      );
      expect(await screen.findByText('Luis Gómez')).toBeInTheDocument();
      expect(mocks.canChange).toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Me equivoqué de persona' })).toBeNull();
    });
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../../app/routes';
import { makeAuth, makeProfile, renderRoutes } from '../../../test/utils';
import * as eventApi from '../../event/api';
import type { EventRow, Participant } from '../../event/api';

vi.mock('../../event/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../event/api')>()),
  fetchActiveEvent: vi.fn(),
  fetchParticipants: vi.fn(),
  fetchExclusions: vi.fn().mockResolvedValue([]),
  fetchEventStats: vi.fn(),
  fetchDrawSummary: vi.fn(),
  runLifecycleAction: vi.fn(),
  releaseRecipient: vi.fn(),
  createEvent: vi.fn(),
}));
vi.mock('../../profile/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../profile/api')>()),
  fetchProfiles: vi.fn().mockResolvedValue([]),
}));

const api = vi.mocked(eventApi);
const admin = () => makeAuth({ profile: makeProfile({ role: 'admin' }) });

const baseEvent = {
  id: 'e1',
  name: 'Navidad 2026',
  description: null,
  rules: null,
  budget_amount: 25,
  currency: 'USD',
  location: null,
  registration_deadline: null,
  exchange_at: null,
  draw_mode: 'app',
  drawn_at: null,
  published_at: null,
  created_by: 'user-1',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
} satisfies Omit<EventRow, 'status'>;

const participant = (id: string, name: string, status: Participant['status']): Participant => ({
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

describe('AdminEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchParticipants.mockResolvedValue([
      participant('a', 'Ana', 'confirmed'),
      participant('b', 'Luis', 'confirmed'),
      participant('c', 'María', 'invited'),
    ]);
    api.fetchEventStats.mockResolvedValue({
      invited: 1,
      confirmed: 2,
      declined: 0,
      with_wishlist: 2,
      with_preferences: 1,
      pending_password: 1,
      conversations_started: 0,
      messages_total: 0,
    });
    api.fetchDrawSummary.mockResolvedValue({ confirmed: 3, assigned: 3, is_valid: true });
    api.runLifecycleAction.mockResolvedValue();
  });

  it('sin evento ofrece crearlo', async () => {
    api.fetchActiveEvent.mockResolvedValue(null);
    renderRoutes(routes, '/admin/evento', admin());
    expect(await screen.findByRole('heading', { name: 'Nuevo evento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear evento' })).toBeInTheDocument();
  });

  it('en inscripción: estadísticas y aviso de quién queda fuera antes de sortear', async () => {
    api.fetchActiveEvent.mockResolvedValue({ ...baseEvent, status: 'open' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoutes(routes, '/admin/evento', admin());

    expect(await screen.findByText('Participación')).toBeInTheDocument();
    expect(screen.getByText('2 de 3')).toBeInTheDocument(); // con lista de deseos
    expect(screen.getByText('No han entrado nunca a la app')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hacer el sorteo' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('1 persona(s) aún no han respondido'),
    );
    expect(api.runLifecycleAction).toHaveBeenCalledWith('run_draw', 'e1');
  });

  it('sorteado: permite publicar o repetir, y recuerda que nadie ve las parejas', async () => {
    api.fetchActiveEvent.mockResolvedValue({ ...baseEvent, status: 'drawn' });
    renderRoutes(routes, '/admin/evento', admin());

    expect(await screen.findByRole('button', { name: 'Publicar resultados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Repetir sorteo' })).toBeInTheDocument();
    expect(await screen.findByText(/Sorteo válido: 3 de 3/)).toBeInTheDocument();
    expect(screen.getByText(/nadie \(tampoco los administradores\)/)).toBeInTheDocument();
    // Ya no se pueden añadir personas ni exclusiones
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it('cancelar la confirmación no ejecuta nada', async () => {
    api.fetchActiveEvent.mockResolvedValue({ ...baseEvent, status: 'drawn' });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderRoutes(routes, '/admin/evento', admin());
    await userEvent.click(await screen.findByRole('button', { name: 'Publicar resultados' }));
    expect(api.runLifecycleAction).not.toHaveBeenCalled();
  });

  it('en inscripción permite indicar que el sorteo ya se hizo con papelitos', async () => {
    api.fetchActiveEvent.mockResolvedValue({ ...baseEvent, status: 'open' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoutes(routes, '/admin/evento', admin());

    await userEvent.click(
      await screen.findByRole('button', { name: 'El sorteo ya se hizo (papelitos)' }),
    );
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Nadie, tampoco tú'));
    expect(api.runLifecycleAction).toHaveBeenCalledWith('start_manual_event', 'e1');
  });

  it('con papelitos muestra el progreso y permite liberar a una persona', async () => {
    api.fetchActiveEvent.mockResolvedValue({
      ...baseEvent,
      status: 'published',
      draw_mode: 'manual',
    });
    api.fetchDrawSummary.mockResolvedValue({ confirmed: 3, assigned: 1, is_valid: false });
    api.releaseRecipient.mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderRoutes(routes, '/admin/evento', admin());

    expect(
      await screen.findByText(/1 de 3 participantes ya registraron a su amigo secreto/),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Persona a liberar'), 'b');
    await userEvent.click(screen.getByRole('button', { name: 'Liberar' }));
    expect(api.releaseRecipient).toHaveBeenCalledWith('e1', 'b');
    expect(
      await screen.findByText('Luis vuelve a estar libre para registrarse.'),
    ).toBeInTheDocument();
  });
});

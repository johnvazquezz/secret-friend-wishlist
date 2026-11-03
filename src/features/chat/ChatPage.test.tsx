import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { renderRoutes } from '../../test/utils';
import type { EventRow } from '../event/api';
import { fetchActiveEvent } from '../event/api';
import {
  fetchMessages,
  fetchThreads,
  markThreadRead,
  sendMessage,
  subscribeToThreads,
  type Message,
  type Thread,
} from './api';

vi.mock('../event/api', () => ({ fetchActiveEvent: vi.fn() }));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchThreads: vi.fn(),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markThreadRead: vi.fn(),
  subscribeToThreads: vi.fn(() => () => {}),
}));

const mocks = {
  event: vi.mocked(fetchActiveEvent),
  threads: vi.mocked(fetchThreads),
  messages: vi.mocked(fetchMessages),
  send: vi.mocked(sendMessage),
  markRead: vi.mocked(markThreadRead),
  subscribe: vi.mocked(subscribeToThreads),
};

const event = { id: 'event-1', name: 'Navidad', status: 'published' } as EventRow;

const threads: Thread[] = [
  {
    thread_id: 'th-giver',
    my_role: 'giver',
    partner_name: 'Luis Gómez',
    partner_avatar_path: null,
    unread: 0,
    last_message_at: null,
  },
  {
    thread_id: 'th-receiver',
    my_role: 'receiver',
    partner_name: null,
    partner_avatar_path: null,
    unread: 2,
    last_message_at: null,
  },
];

const message = (id: string, thread_id: string, author_role: 'giver' | 'receiver'): Message => ({
  id,
  thread_id,
  author_role,
  body: `mensaje ${id}`,
  created_at: '2026-12-01T10:00:00Z',
  read_at: null,
});

describe('ChatPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.subscribe.mockReturnValue(() => {});
    mocks.event.mockResolvedValue(event);
    mocks.threads.mockResolvedValue(threads);
    mocks.messages.mockImplementation(async (threadId) =>
      threadId === 'th-receiver'
        ? [message('1', 'th-receiver', 'giver'), message('2', 'th-receiver', 'giver')]
        : [message('3', 'th-giver', 'giver')],
    );
    mocks.markRead.mockResolvedValue();
    mocks.send.mockResolvedValue();
  });

  it('antes de publicar avisa de que el chat no está abierto', async () => {
    mocks.event.mockResolvedValue({ ...event, status: 'open' });
    renderRoutes(routes, '/mensajes');
    expect(await screen.findByText(/se abrirá cuando se publique/)).toBeInTheDocument();
    expect(mocks.threads).not.toHaveBeenCalled();
  });

  it('muestra al amigo secreto como anónimo y marca como leídos sus mensajes', async () => {
    renderRoutes(routes, '/mensajes');
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringContaining('Tu amigo secreto'),
      expect.stringContaining('Luis Gómez'),
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(within(tabs[0]).getByLabelText('2 sin leer')).toBeInTheDocument();

    expect(await screen.findByText('mensaje 1')).toBeInTheDocument();
    expect(mocks.markRead).toHaveBeenCalledWith('th-receiver');
    // En ningún lugar aparece un nombre para el amigo secreto
    expect(
      screen.getByRole('log', { name: 'Conversación con Tu amigo secreto' }),
    ).toBeInTheDocument();
  });

  it('el badge de no leídos aparece en la navegación', async () => {
    renderRoutes(routes, '/');
    expect(await screen.findByRole('link', { name: /Mensajes/ })).toBeInTheDocument();
    expect(screen.getByLabelText('2 sin leer')).toBeInTheDocument();
  });

  it('envía un mensaje con Enter en la conversación con el destinatario', async () => {
    renderRoutes(routes, '/mensajes');
    await userEvent.click(await screen.findByRole('tab', { name: /Luis Gómez/ }));
    expect(await screen.findByText(/Luis Gómez no sabe que eres tú/)).toBeInTheDocument();

    const input = screen.getByLabelText('Escribe un mensaje a Luis Gómez');
    await userEvent.type(input, '¿Qué talla usas?{Enter}');
    expect(mocks.send).toHaveBeenCalledWith('event-1', 'giver', '¿Qué talla usas?');
  });

  it('se suscribe en tiempo real a sus dos conversaciones', async () => {
    renderRoutes(routes, '/mensajes');
    await screen.findAllByRole('tab');
    expect(mocks.subscribe).toHaveBeenCalledWith(['th-giver', 'th-receiver'], expect.any(Function));
  });
});

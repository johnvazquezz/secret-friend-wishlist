import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { renderRoutes } from '../../test/utils';
import type { EventRow, Participant } from '../event/api';
import { fetchActiveEvent, fetchMyParticipation, fetchParticipants } from '../event/api';
import {
  fetchConversations,
  fetchMessages,
  markThreadRead,
  sendThreadMessage,
  setThreadBlocked,
  startConversation,
  subscribeToMyMessages,
  type Conversation,
  type Message,
} from './api';

vi.mock('../event/api', () => ({
  fetchActiveEvent: vi.fn(),
  fetchMyParticipation: vi.fn(),
  fetchParticipants: vi.fn(),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchConversations: vi.fn(),
  fetchMessages: vi.fn(),
  sendThreadMessage: vi.fn(),
  startConversation: vi.fn(),
  setThreadBlocked: vi.fn(),
  markThreadRead: vi.fn(),
  subscribeToMyMessages: vi.fn(() => () => {}),
}));

const mocks = {
  event: vi.mocked(fetchActiveEvent),
  participation: vi.mocked(fetchMyParticipation),
  participants: vi.mocked(fetchParticipants),
  conversations: vi.mocked(fetchConversations),
  messages: vi.mocked(fetchMessages),
  send: vi.mocked(sendThreadMessage),
  start: vi.mocked(startConversation),
  block: vi.mocked(setThreadBlocked),
  markRead: vi.mocked(markThreadRead),
  subscribe: vi.mocked(subscribeToMyMessages),
};

const event = { id: 'event-1', name: 'Navidad', status: 'published' } as EventRow;

const base: Omit<Conversation, 'thread_id' | 'my_role'> = {
  partner_name: null,
  partner_avatar_path: null,
  partner_alias: null,
  my_alias: null,
  is_my_recipient: false,
  unread: 0,
  last_message_at: '2026-12-01T10:00:00Z',
  blocked_by_me: false,
  blocked_by_partner: false,
};

const conversations: Conversation[] = [
  // Quien me regala (hilo del sorteo): sale como un anónimo más
  {
    ...base,
    thread_id: 'th-anon-1',
    my_role: 'receiver',
    partner_alias: 'Reno misterioso 🦌',
    unread: 2,
  },
  // Alguien que me escribe en secreto para despistar: idéntico
  { ...base, thread_id: 'th-anon-2', my_role: 'receiver', partner_alias: 'Duende travieso 🎄' },
  // A quien yo regalo
  {
    ...base,
    thread_id: 'th-giver',
    my_role: 'giver',
    partner_name: 'Luis Gómez',
    my_alias: 'Copo de nieve ❄️',
    is_my_recipient: true,
  },
];

const person = (id: string, name: string): Participant => ({
  user_id: id,
  status: 'confirmed',
  responded_at: null,
  profile: {
    full_name: name,
    email: `${id}@x.com`,
    department: null,
    avatar_path: null,
    is_active: true,
  },
});

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
    mocks.participation.mockResolvedValue('confirmed');
    mocks.participants.mockResolvedValue([
      person('user-1', 'Ana Pérez'),
      person('user-2', 'Pedro Ruiz'),
      person('user-3', 'Luis Gómez'),
    ]);
    mocks.conversations.mockResolvedValue(conversations);
    mocks.messages.mockImplementation(async (threadId) => [message(threadId, threadId, 'giver')]);
    mocks.markRead.mockResolvedValue();
    mocks.send.mockResolvedValue();
    mocks.block.mockResolvedValue();
    mocks.start.mockResolvedValue('th-new');
  });

  it('antes de publicar avisa de que el chat no está abierto', async () => {
    mocks.event.mockResolvedValue({ ...event, status: 'open' });
    renderRoutes(routes, '/mensajes');
    expect(await screen.findByText(/se abrirá cuando se publique/)).toBeInTheDocument();
    expect(mocks.conversations).not.toHaveBeenCalled();
  });

  it('los chats anónimos son todos iguales: ninguno se marca como "tu amigo secreto"', async () => {
    renderRoutes(routes, '/mensajes');
    const list = await screen.findByRole('navigation', { name: 'Conversaciones' });
    const items = within(list).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Reno misterioso'),
      expect.stringContaining('Duende travieso'),
      expect.stringContaining('Luis Gómez'),
    ]);
    // Los dos anónimos se ven igual; solo mi destinatario lleva la etiqueta (y solo yo la veo)
    expect(items[0]).toHaveTextContent('Anónimo');
    expect(items[1]).toHaveTextContent('Anónimo');
    expect(items[0]).not.toHaveTextContent('amigo secreto');
    expect(items[2]).toHaveTextContent('Tu amigo secreto');
    expect(within(items[0]).getByLabelText('2 sin leer')).toBeInTheDocument();

    // Se abre el primero y se marcan como leídos sus mensajes
    expect(await screen.findByText('mensaje th-anon-1')).toBeInTheDocument();
    expect(mocks.markRead).toHaveBeenCalledWith('th-anon-1');
    expect(screen.getByText(/Puede que sea tu amigo secreto, o puede que no/)).toBeInTheDocument();
  });

  it('envía un mensaje con Enter a mi destinatario, que no sabe que soy yo', async () => {
    renderRoutes(routes, '/mensajes?chat=amigo');
    expect(await screen.findByText(/Luis no sabe que eres tú/)).toBeInTheDocument();
    expect(screen.getByText(/Escribes como «Copo de nieve ❄️»/)).toBeInTheDocument();

    const input = screen.getByLabelText('Escribe un mensaje a Luis Gómez');
    await userEvent.type(input, '¿Qué talla usas?{Enter}');
    expect(mocks.send).toHaveBeenCalledWith('th-giver', '¿Qué talla usas?');
  });

  it('escribe en secreto a cualquier participante', async () => {
    renderRoutes(routes, '/mensajes');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo mensaje' }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo mensaje' });
    // No me ofrece escribirme a mí mismo (Ana es la usuaria por defecto de los tests)
    expect(within(dialog).queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('switch', { name: /Escribir en secreto/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: /Pedro Ruiz/ }));
    await userEvent.type(within(dialog).getByLabelText('Mensaje'), 'Te dejé un turrón 🍫');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar en secreto' }));

    expect(mocks.start).toHaveBeenCalledWith('event-1', {
      recipientId: 'user-2',
      anonymous: true,
      body: 'Te dejé un turrón 🍫',
    });
    expect(await screen.findByText('Mensaje enviado en secreto 🤫')).toBeInTheDocument();
  });

  it('también se puede escribir con el nombre', async () => {
    renderRoutes(routes, '/mensajes');
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo mensaje' }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo mensaje' });
    await userEvent.click(within(dialog).getByRole('switch', { name: /Escribir en secreto/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Luis Gómez/ }));
    await userEvent.type(within(dialog).getByLabelText('Mensaje'), '¡Hola!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar' }));
    expect(mocks.start).toHaveBeenCalledWith('event-1', {
      recipientId: 'user-3',
      anonymous: false,
      body: '¡Hola!',
    });
  });

  it('silenciar un chat pide confirmación en el diálogo de la app', async () => {
    renderRoutes(routes, '/mensajes?chat=th-anon-2');
    await userEvent.click(await screen.findByRole('button', { name: 'Silenciar' }));
    const confirm = screen.getByRole('alertdialog', {
      name: '¿Silenciar el chat con Duende travieso 🎄?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Silenciar' }));
    expect(mocks.block).toHaveBeenCalledWith('th-anon-2', true);
  });

  it('el badge de no leídos aparece en la navegación', async () => {
    renderRoutes(routes, '/');
    expect(await screen.findByRole('link', { name: /Mensajes/ })).toBeInTheDocument();
    expect(await screen.findByLabelText('2 sin leer')).toBeInTheDocument();
  });

  it('se suscribe en tiempo real a todos sus mensajes, también de chats nuevos', async () => {
    renderRoutes(routes, '/mensajes');
    await screen.findByRole('navigation', { name: 'Conversaciones' });
    expect(mocks.subscribe).toHaveBeenCalledWith('event-1:user-1', expect.any(Function));
  });
});

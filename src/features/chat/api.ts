import type { Database, Tables } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type ChatRole = Database['public']['Enums']['chat_role'];
export type Message = Tables<'messages'>;

/**
 * Una conversación (del sorteo o libre: la API no dice de cuál se trata).
 * - partner_name/partner_avatar_path: solo si la otra persona escribe con su nombre.
 * - partner_alias: alias de la otra persona cuando es anónima para mí.
 * - my_alias: mi alias cuando yo escribo en secreto.
 * - is_my_recipient: es la persona a la que yo regalo.
 */
export interface Conversation {
  thread_id: string;
  my_role: ChatRole;
  partner_name: string | null;
  partner_avatar_path: string | null;
  partner_alias: string | null;
  my_alias: string | null;
  is_my_recipient: boolean;
  unread: number;
  last_message_at: string | null;
  blocked_by_me: boolean;
  blocked_by_partner: boolean;
}

export const MAX_MESSAGE_LENGTH = 1000;

/** Nombre visible de la otra persona en una conversación. */
export function partnerLabel(c: Pick<Conversation, 'partner_name' | 'partner_alias'>): string {
  return c.partner_name ?? c.partner_alias ?? 'Alguien';
}

/** Emoji del alias ("Reno misterioso 🦌" → "🦌"), para el avatar de los anónimos. */
export function aliasEmoji(alias: string | null): string {
  if (!alias) return '🎭';
  const parts = alias.split(' ');
  return parts[parts.length - 1] || '🎭';
}

export async function fetchConversations(eventId: string): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('get_my_conversations', { p_event_id: eventId });
  if (error) throw error;
  // Los tipos generados no marcan como opcionales las columnas que pueden ser null.
  return (data ?? []) as Conversation[];
}

export async function fetchMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function sendThreadMessage(threadId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('send_thread_message', {
    p_thread_id: threadId,
    p_body: body,
  });
  if (error) throw error;
}

export interface StartConversationInput {
  recipientId: string;
  anonymous: boolean;
  body: string;
}

/** Abre (o reutiliza) un chat y envía el primer mensaje. Devuelve el id del hilo. */
export async function startConversation(
  eventId: string,
  { recipientId, anonymous, body }: StartConversationInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', {
    p_event_id: eventId,
    p_recipient_id: recipientId,
    p_anonymous: anonymous,
    p_body: body,
  });
  if (error) throw error;
  return data;
}

export async function setThreadBlocked(threadId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_thread_blocked', {
    p_thread_id: threadId,
    p_blocked: blocked,
  });
  if (error) throw error;
}

export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_thread_read', { p_thread_id: threadId });
  if (error) throw error;
}

/**
 * Escucha los mensajes nuevos de TODAS mis conversaciones en tiempo real, también de chats que
 * otra persona me abra después. No hace falta filtrar por hilo: Realtime aplica la misma RLS que
 * las consultas y solo entrega mensajes de mis hilos.
 */
export function subscribeToMyMessages(
  channelKey: string,
  onInsert: (message: Message) => void,
): () => void {
  let cancelled = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  void (async () => {
    // realtime-js conecta el socket y obtiene el token en segundo plano: si el canal se une antes,
    // queda registrado como `anon` y la RLS no deja pasar ningún mensaje. Esperamos el token.
    await supabase.realtime.setAuth();
    if (cancelled) return;
    channel = supabase
      .channel(`chat:${channelKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
        onInsert(payload.new as Message),
      );
    channel.subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

import type { Database, Tables } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type ChatRole = Database['public']['Enums']['chat_role'];
export type Message = Tables<'messages'>;

export interface Thread {
  thread_id: string;
  my_role: ChatRole;
  /** Solo se conoce cuando soy quien regala. Del lado "receiver" siempre es null. */
  partner_name: string | null;
  partner_avatar_path: string | null;
  unread: number;
  last_message_at: string | null;
}

export const MAX_MESSAGE_LENGTH = 1000;

export async function fetchThreads(eventId: string): Promise<Thread[]> {
  const { data, error } = await supabase.rpc('get_my_threads', { p_event_id: eventId });
  if (error) throw error;
  return data ?? [];
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

export async function sendMessage(eventId: string, as: ChatRole, body: string): Promise<void> {
  const { error } = await supabase.rpc('send_message', {
    p_event_id: eventId,
    p_as: as,
    p_body: body,
  });
  if (error) throw error;
}

export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_thread_read', { p_thread_id: threadId });
  if (error) throw error;
}

/**
 * Escucha mensajes nuevos de mis conversaciones en tiempo real.
 * Realtime aplica la misma RLS que las consultas: solo llegan mensajes de mis hilos.
 */
export function subscribeToThreads(
  threadIds: string[],
  onInsert: (message: Message) => void,
): () => void {
  if (threadIds.length === 0) return () => {};
  let cancelled = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  void (async () => {
    // realtime-js conecta el socket y obtiene el token en segundo plano: si el canal se une antes,
    // queda registrado como `anon` y la RLS no deja pasar ningún mensaje. Esperamos el token.
    await supabase.realtime.setAuth();
    if (cancelled) return;
    channel = supabase.channel(`chat:${threadIds.join(',')}`);
    for (const threadId of threadIds) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => onInsert(payload.new as Message),
      );
    }
    channel.subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

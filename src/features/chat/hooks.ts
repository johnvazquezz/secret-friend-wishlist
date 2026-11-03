import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { EventStatus } from '../event/api';
import {
  fetchMessages,
  fetchThreads,
  markThreadRead,
  sendMessage,
  subscribeToThreads,
  type ChatRole,
  type Message,
} from './api';

export const chatKeys = {
  all: ['chat'] as const,
  threads: (eventId: string) => [...chatKeys.all, 'threads', eventId] as const,
  messages: (threadId: string) => [...chatKeys.all, 'messages', threadId] as const,
};

const CHAT_STATUSES: EventStatus[] = ['published', 'finished'];

/** Respaldo por si Realtime pierde algún mensaje (p. ej. en los segundos en que se conecta). */
const FALLBACK_REFETCH_MS = 60_000;

export function isChatAvailable(status: EventStatus | undefined): boolean {
  return !!status && CHAT_STATUSES.includes(status);
}

export function useMyThreads(eventId: string | undefined, status: EventStatus | undefined) {
  return useQuery({
    queryKey: chatKeys.threads(eventId ?? ''),
    queryFn: () => fetchThreads(eventId!),
    enabled: !!eventId && isChatAvailable(status),
    refetchInterval: FALLBACK_REFETCH_MS,
  });
}

export function useThreadMessages(threadId: string) {
  return useQuery({
    queryKey: chatKeys.messages(threadId),
    queryFn: () => fetchMessages(threadId),
    refetchInterval: FALLBACK_REFETCH_MS,
  });
}

/** Añade un mensaje a la caché sin duplicarlo (puede llegar por Realtime y por recarga). */
export function appendMessage(
  list: Message[] | undefined,
  message: Message,
): Message[] | undefined {
  if (!list) return list;
  if (list.some((m) => m.id === message.id)) return list;
  return [...list, message].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Suscripción en tiempo real a mis conversaciones: actualiza mensajes y contadores. */
export function useChatRealtime(eventId: string | undefined, threadIds: string[]) {
  const queryClient = useQueryClient();
  const key = threadIds.join(',');

  useEffect(() => {
    if (!eventId || !key) return;
    return subscribeToThreads(key.split(','), (message) => {
      queryClient.setQueryData<Message[]>(chatKeys.messages(message.thread_id), (list) =>
        appendMessage(list, message),
      );
      void queryClient.invalidateQueries({ queryKey: chatKeys.threads(eventId) });
    });
  }, [eventId, key, queryClient]);
}

export function useSendMessage(eventId: string, as: ChatRole, threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(eventId, as, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.messages(threadId) }),
  });
}

export function useMarkThreadRead(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => markThreadRead(threadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.threads(eventId) }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { EventStatus } from '../event/api';
import {
  fetchConversations,
  fetchMessages,
  markThreadRead,
  sendThreadMessage,
  setThreadBlocked,
  startConversation,
  subscribeToMyMessages,
  type Message,
  type StartConversationInput,
} from './api';

export const chatKeys = {
  all: ['chat'] as const,
  conversations: (eventId: string) => [...chatKeys.all, 'conversations', eventId] as const,
  messages: (threadId: string) => [...chatKeys.all, 'messages', threadId] as const,
};

const CHAT_STATUSES: EventStatus[] = ['published', 'finished'];

/** Respaldo por si Realtime pierde algún mensaje (p. ej. en los segundos en que se conecta). */
const FALLBACK_REFETCH_MS = 60_000;

export function isChatAvailable(status: EventStatus | undefined): boolean {
  return !!status && CHAT_STATUSES.includes(status);
}

export function useMyConversations(eventId: string | undefined, status: EventStatus | undefined) {
  return useQuery({
    queryKey: chatKeys.conversations(eventId ?? ''),
    queryFn: () => fetchConversations(eventId!),
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

/**
 * Tiempo real de todas mis conversaciones: actualiza los mensajes y la bandeja (contadores y
 * chats nuevos que me abran).
 */
export function useChatRealtime(eventId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId || !userId) return;
    return subscribeToMyMessages(`${eventId}:${userId}`, (message) => {
      queryClient.setQueryData<Message[]>(chatKeys.messages(message.thread_id), (list) =>
        appendMessage(list, message),
      );
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations(eventId) });
    });
  }, [eventId, userId, queryClient]);
}

export function useSendMessage(eventId: string, threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendThreadMessage(threadId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(threadId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations(eventId) });
    },
  });
}

export function useStartConversation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartConversationInput) => startConversation(eventId, input),
    onSuccess: (threadId) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(threadId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations(eventId) });
    },
  });
}

export function useSetThreadBlocked(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, blocked }: { threadId: string; blocked: boolean }) =>
      setThreadBlocked(threadId, blocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.conversations(eventId) }),
  });
}

export function useMarkThreadRead(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => markThreadRead(threadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.conversations(eventId) }),
  });
}

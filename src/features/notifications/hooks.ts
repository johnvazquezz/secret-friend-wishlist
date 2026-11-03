import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  sendAnnouncement,
  subscribeToNotifications,
} from './api';

export const notificationKeys = { all: ['notifications'] as const };

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribeToNotifications(userId, () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      // Las notificaciones avisan de cambios (inscripción abierta, sorteo publicado…):
      // refrescar también el evento y el chat para que la pantalla no quede desactualizada.
      void queryClient.invalidateQueries({ queryKey: ['event'] });
      void queryClient.invalidateQueries({ queryKey: ['chat'] });
    });
  }, [userId, queryClient]);

  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: fetchNotifications,
    enabled: !!userId,
    refetchInterval: 5 * 60_000, // respaldo si Realtime pierde algo
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) => sendAnnouncement(title, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

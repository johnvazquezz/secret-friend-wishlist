import type { Tables } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type Notification = Tables<'notifications'>;

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_read', {});
  if (error) throw error;
}

export async function sendAnnouncement(title: string, body: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_announcement', {
    p_title: title,
    p_body: body,
  });
  if (error) throw error;
  return data;
}

/** Notificaciones nuevas en tiempo real (la RLS solo deja pasar las propias). */
export function subscribeToNotifications(userId: string, onInsert: () => void): () => void {
  let cancelled = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  void (async () => {
    // Esperar el token: si no, el canal se une como `anon` (ver chat/api.ts).
    await supabase.realtime.setAuth();
    if (cancelled) return;
    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => onInsert(),
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

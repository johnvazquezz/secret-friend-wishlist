import type { Tables } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type WishlistItem = Tables<'wishlist_items'>;
export type Preferences = Pick<
  Tables<'user_preferences'>,
  'likes' | 'dislikes' | 'sizes' | 'allergies' | 'notes'
>;

export interface WishlistItemInput {
  title: string;
  url: string | null;
  notes: string | null;
  price_hint: number | null;
  priority: number;
}

export const MAX_WISHLIST_ITEMS = 20;

function sortItems(items: WishlistItem[]): WishlistItem[] {
  return [...items].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
}

export async function fetchWishlist(userId: string): Promise<WishlistItem[]> {
  const { data, error } = await supabase.from('wishlist_items').select('*').eq('user_id', userId);
  if (error) throw error;
  return sortItems(data ?? []);
}

/** Todas las listas, agrupadas por persona. */
export async function fetchAllWishlists(): Promise<Record<string, WishlistItem[]>> {
  const { data, error } = await supabase.from('wishlist_items').select('*');
  if (error) throw error;
  const byUser: Record<string, WishlistItem[]> = {};
  for (const item of data ?? []) (byUser[item.user_id] ??= []).push(item);
  for (const userId of Object.keys(byUser)) byUser[userId] = sortItems(byUser[userId]);
  return byUser;
}

export async function createWishlistItem(
  input: WishlistItemInput,
  position: number,
): Promise<void> {
  const { error } = await supabase.from('wishlist_items').insert({ ...input, position });
  if (error) throw error;
}

export async function updateWishlistItem(id: string, input: WishlistItemInput): Promise<void> {
  const { error } = await supabase.from('wishlist_items').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) throw error;
}

/** Guarda un nuevo orden (posición = índice en la lista). */
export async function reorderWishlist(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, position) => supabase.from('wishlist_items').update({ position }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function fetchMyPreferences(): Promise<Preferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('likes, dislikes, sizes, allergies, notes')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePreferences(input: Preferences): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(input);
  if (error) throw error;
}

export async function fetchRecipientPreferences(eventId: string): Promise<Preferences | null> {
  const { data, error } = await supabase.rpc('get_my_recipient_preferences', {
    p_event_id: eventId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

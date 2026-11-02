import type { Tables } from '../../lib/database.types';
import { AppError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export type Profile = Tables<'profiles'>;

export interface ProfileUpdate {
  full_name: string;
  department: string | null;
}

const AVATAR_BUCKET = 'avatars';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new AppError('No tienes permiso para modificar este perfil.');
}

export function avatarPathFor(userId: string): string {
  return `${userId}/avatar.webp`;
}

export async function uploadAvatar(userId: string, image: Blob): Promise<void> {
  const path = avatarPathFor(userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, image, { upsert: true, contentType: image.type, cacheControl: '0' });
  if (uploadError) throw new AppError('No se pudo subir la foto.');

  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (error) throw error;
}

export async function removeAvatar(userId: string): Promise<void> {
  const path = avatarPathFor(userId);
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (error) throw error;
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

/** URLs firmadas (bucket privado) para un conjunto de rutas de avatar. */
export async function fetchAvatarUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

import type { Tables } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

/** Datos públicos de un miembro. Nunca incluye `access_code`. */
export type Member = Pick<Tables<'team_members'>, 'id' | 'name' | 'wishes'>;

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, wishes')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

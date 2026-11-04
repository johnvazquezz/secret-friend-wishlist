import { FunctionsHttpError } from '@supabase/supabase-js';
import { AppError } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import type { NewUser } from './bulkParse';

export interface CreateUserResult {
  email: string;
  full_name?: string;
  ok: boolean;
  temp_password?: string;
  error?: string;
}

type AdminUsersRequest =
  | { action: 'create'; users: NewUser[] }
  | { action: 'reset_password'; user_id: string }
  | { action: 'set_role'; user_id: string; role: 'participant' | 'admin' }
  | { action: 'set_active'; user_id: string; active: boolean };

async function callAdminUsers<T>(body: AdminUsersRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string } | null;
      throw new AppError(payload?.error ?? 'La operación no se pudo completar.');
    }
    throw new AppError('No se pudo contactar con el servidor.');
  }
  return data as T;
}

export async function createUsers(users: NewUser[]): Promise<CreateUserResult[]> {
  const { results } = await callAdminUsers<{ results: CreateUserResult[] }>({
    action: 'create',
    users,
  });
  return results;
}

export async function resetPassword(userId: string): Promise<string> {
  const { temp_password } = await callAdminUsers<{ temp_password: string }>({
    action: 'reset_password',
    user_id: userId,
  });
  return temp_password;
}

export async function setRole(userId: string, role: 'participant' | 'admin'): Promise<void> {
  await callAdminUsers({ action: 'set_role', user_id: userId, role });
}

export async function setActive(userId: string, active: boolean): Promise<void> {
  await callAdminUsers({ action: 'set_active', user_id: userId, active });
}

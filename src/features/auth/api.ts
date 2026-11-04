import { AppError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (!error) return;
  if (error.code === 'invalid_credentials') {
    throw new AppError('Email o contraseña incorrectos.');
  }
  if (error.code === 'user_banned') {
    throw new AppError('Tu cuenta está desactivada. Contacta con el organizador.');
  }
  throw new AppError('No se pudo iniciar sesión. Inténtalo de nuevo.');
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.code === 'same_password') {
      throw new AppError('La nueva contraseña debe ser distinta de la actual.');
    }
    if (error.code === 'weak_password') {
      throw new AppError(
        'La contraseña es demasiado débil. Usa al menos 10 caracteres con letras y números.',
      );
    }
    throw new AppError('No se pudo cambiar la contraseña.');
  }
  const { error: rpcError } = await supabase.rpc('complete_password_change');
  if (rpcError) throw rpcError;
}

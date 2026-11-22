import type { Json } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

/** Guarda (o renueva) la suscripción push de este navegador para el usuario actual. */
export async function registerPushSubscription(
  subscription: PushSubscriptionJSON,
  userAgent: string,
): Promise<void> {
  const { error } = await supabase.rpc('register_push_subscription', {
    p_subscription: subscription as Json,
    p_user_agent: userAgent,
  });
  if (error) throw error;
}

/** Borra la suscripción de este navegador (la RLS solo deja borrar las propias). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

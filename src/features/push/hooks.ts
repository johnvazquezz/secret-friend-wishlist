import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../components/ui/toast';
import {
  disablePush,
  enablePush,
  getPushStatus,
  syncPushSubscription,
  type PushStatus,
} from './browser';

/** Estado de las notificaciones push en este dispositivo y acciones para activarlas o no. */
export function usePushNotifications(userId: string | undefined) {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getPushStatus(userId)
      .then((next) => active && setStatus(next))
      .catch(() => active && setStatus('off'));
    return () => {
      active = false;
    };
  }, [userId]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const next = await enablePush(userId);
      setStatus(next);
      if (next === 'on') {
        toast.success('Notificaciones activadas 🔔', 'Te avisaremos aunque tengas la app cerrada.');
      } else if (next === 'denied') {
        toast.error(
          'Bloqueaste las notificaciones',
          'Puedes permitirlas en los ajustes del sitio.',
        );
      }
    } catch (error) {
      console.error('No se pudieron activar las notificaciones', error);
      toast.error('No se pudieron activar las notificaciones', 'Inténtalo de nuevo en un momento.');
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush();
      setStatus('off');
      toast.info('Notificaciones desactivadas en este dispositivo.');
    } catch (error) {
      console.error('No se pudieron desactivar las notificaciones', error);
      toast.error('No se pudieron desactivar las notificaciones', 'Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable };
}

/** Al abrir la app con sesión, mantiene al día la suscripción de este dispositivo. */
export function usePushSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    syncPushSubscription(userId).catch((error) =>
      console.warn('No se pudo sincronizar la suscripción push', error),
    );
  }, [userId]);
}

/**
 * Al tocar una notificación con la app ya abierta, el service worker pide navegar a la
 * conversación sin recargar la página.
 */
export function useServiceWorkerNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const container = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    if (!container) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type !== 'navigate' || typeof data.url !== 'string') return;
      // Solo rutas internas: '/x', nunca '//dominio' ni '/\dominio'.
      if (!/^\/(?![/\\])/.test(data.url)) return;
      navigate(data.url);
    };
    container.addEventListener('message', onMessage);
    container.startMessages?.();
    return () => container.removeEventListener('message', onMessage);
  }, [navigate]);
}

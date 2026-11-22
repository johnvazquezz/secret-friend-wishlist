/* Service worker de Amigo Secreto: SOLO notificaciones push.
 *
 * No intercepta peticiones ni guarda nada en caché (sin evento fetch): la web siempre se carga
 * de la red, así que un despliegue nuevo nunca queda "atascado" en una versión vieja.
 *
 * Payload (lo envía la Edge Function send-push):
 *   { kind: 'chat' | 'notification', title, body, url, tag, threadId }
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** Solo rutas internas: '/x', nunca '//dominio' ni '/\dominio'. */
function safePath(url) {
  return typeof url === 'string' && /^\/(?![/\\])/.test(url) ? url : '/';
}

function appWindows() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
}

/** ¿Hay una ventana visible con esta conversación abierta? */
function isChatOpen(windows, threadId) {
  return windows.some((client) => {
    if (client.visibilityState !== 'visible') return false;
    const url = new URL(client.url);
    return url.pathname === '/mensajes' && url.searchParams.get('chat') === threadId;
  });
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    (async () => {
      const windows = await appWindows();
      // Ya está leyendo esa conversación: el mensaje aparece en pantalla en tiempo real.
      if (data.kind === 'chat' && data.threadId && isChatOpen(windows, data.threadId)) return;
      // Avisos con la app visible: la campana ya los muestra al instante.
      if (data.kind === 'notification' && windows.some((c) => c.visibilityState === 'visible')) {
        return;
      }

      const tag = typeof data.tag === 'string' && data.tag ? data.tag : undefined;
      await self.registration.showNotification(
        typeof data.title === 'string' && data.title ? data.title : 'Amigo Secreto',
        {
          body: typeof data.body === 'string' ? data.body : '',
          tag,
          renotify: !!tag, // mismo chat: reemplaza la anterior, pero vuelve a sonar
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-96.png',
          lang: 'es',
          data: { url: safePath(data.url) },
        },
      );
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windows = await appWindows();
      const client =
        windows.find((c) => c.visibilityState === 'visible') ||
        windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        // La app abierta navega sin recargar (useServiceWorkerNavigation).
        await client.focus();
        client.postMessage({ type: 'navigate', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// El navegador renovó la suscripción (poco habitual): se vuelve a suscribir con las mismas
// opciones; la app la guarda en Supabase la próxima vez que se abra (syncPushSubscription).
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription && event.oldSubscription.options;
  if (!options) return;
  event.waitUntil(self.registration.pushManager.subscribe(options).catch(() => undefined));
});

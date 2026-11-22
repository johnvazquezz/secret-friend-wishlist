import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePushSubscription, registerPushSubscription } from './api';
import {
  disablePush,
  enablePush,
  getPushStatus,
  isIos,
  syncPushSubscription,
  urlBase64ToUint8Array,
} from './browser';

const KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

vi.mock('../../lib/env', () => ({
  env: {
    VITE_VAPID_PUBLIC_KEY:
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  },
}));
vi.mock('./api', () => ({
  registerPushSubscription: vi.fn().mockResolvedValue(undefined),
  deletePushSubscription: vi.fn().mockResolvedValue(undefined),
}));

/** Navegador falso con service worker, PushManager y Notification. */
function installFakePush(permission: NotificationPermission, requested = permission) {
  const subscriptionJson = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'p', auth: 'a' },
  };
  let current: PushSubscription | null = null;
  const makeSubscription = (key: Uint8Array) =>
    ({
      endpoint: subscriptionJson.endpoint,
      options: { applicationServerKey: key.buffer, userVisibleOnly: true },
      toJSON: () => subscriptionJson,
      unsubscribe: vi.fn(async () => {
        current = null;
        return true;
      }),
    }) as unknown as PushSubscription;

  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async (options: PushSubscriptionOptionsInit) => {
      current = makeSubscription(options.applicationServerKey as Uint8Array);
      return current;
    }),
  };
  const registration = { pushManager };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(async () => registration),
    },
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn(async () => {
      (globalThis.Notification as { permission: NotificationPermission }).permission = requested;
      return requested;
    }),
  });
  return {
    pushManager,
    get current() {
      return current;
    },
    setCurrent: (key: Uint8Array) => (current = makeSubscription(key)),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(registerPushSubscription).mockClear();
  vi.mocked(deletePushSubscription).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('utilidades', () => {
  it('convierte la clave pública VAPID a bytes', () => {
    const bytes = urlBase64ToUint8Array(KEY);
    expect(bytes).toHaveLength(65); // punto P-256 sin comprimir
    expect(bytes[0]).toBe(4);
  });

  it('detecta iPhone y iPad (también el iPad que se presenta como Mac)', () => {
    const ua = (userAgent: string, platform = '', maxTouchPoints = 0) => ({
      userAgent,
      platform,
      maxTouchPoints,
    });
    expect(isIos(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe(true);
    expect(isIos(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5))).toBe(true);
    expect(isIos(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0))).toBe(false);
    expect(isIos(ua('Mozilla/5.0 (Linux; Android 14) Chrome/130'))).toBe(false);
  });
});

describe('estado y activación', () => {
  it('sin soporte de push en el navegador', async () => {
    expect(await getPushStatus('u1')).toBe('unsupported');
  });

  it('permiso bloqueado', async () => {
    installFakePush('denied');
    expect(await getPushStatus('u1')).toBe('denied');
  });

  it('activar pide permiso, suscribe y guarda en Supabase', async () => {
    const fake = installFakePush('default', 'granted');
    expect(await getPushStatus('u1')).toBe('off');

    expect(await enablePush('u1')).toBe('on');
    expect(fake.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(registerPushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }),
      expect.any(String),
    );
    expect(await getPushStatus('u1')).toBe('on');
    // Otra persona en el mismo navegador no la ve como suya
    expect(await getPushStatus('u2')).toBe('off');
  });

  it('si rechaza el permiso no se suscribe', async () => {
    const fake = installFakePush('default', 'denied');
    expect(await enablePush('u1')).toBe('denied');
    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
    expect(registerPushSubscription).not.toHaveBeenCalled();
  });

  it('si no se puede guardar, anula la suscripción del navegador', async () => {
    const fake = installFakePush('granted');
    vi.mocked(registerPushSubscription).mockRejectedValueOnce(new Error('red'));
    await expect(enablePush('u1')).rejects.toThrow('red');
    expect(fake.current).toBeNull();
  });

  it('desactivar borra la fila y anula la suscripción', async () => {
    const fake = installFakePush('granted');
    await enablePush('u1');
    await disablePush();
    expect(deletePushSubscription).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/abc');
    expect(fake.current).toBeNull();
    expect(await getPushStatus('u1')).toBe('off');
  });
});

describe('sincronización al abrir la app', () => {
  it('renueva la suscripción de la misma persona', async () => {
    installFakePush('granted');
    await enablePush('u1');
    vi.mocked(registerPushSubscription).mockClear();
    await syncPushSubscription('u1');
    expect(registerPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('anula la suscripción si ahora la sesión es de otra persona', async () => {
    const fake = installFakePush('granted');
    await enablePush('u1');
    vi.mocked(registerPushSubscription).mockClear();
    await syncPushSubscription('u2');
    expect(registerPushSubscription).not.toHaveBeenCalled();
    expect(fake.current).toBeNull();
  });

  it('se vuelve a suscribir si cambió la clave VAPID', async () => {
    const fake = installFakePush('granted');
    await enablePush('u1');
    fake.setCurrent(new Uint8Array([4, 1, 2, 3]));
    vi.mocked(registerPushSubscription).mockClear();
    await syncPushSubscription('u1');
    expect(fake.pushManager.subscribe).toHaveBeenCalledTimes(2);
    expect(registerPushSubscription).toHaveBeenCalledTimes(1);
  });
});

/**
 * Notificaciones push en el navegador: service worker, permiso y suscripción.
 *
 * El permiso se pide SOLO cuando la persona pulsa "Activar notificaciones" (nunca al cargar).
 * En este navegador se recuerda para quién se activó (`push-owner`): si otra persona inicia sesión
 * en el mismo equipo, la suscripción se anula para que no reciba los mensajes de la anterior.
 */
import { env } from '../../lib/env';
import { deletePushSubscription, registerPushSubscription } from './api';

export const SERVICE_WORKER_URL = '/sw.js';
const OWNER_KEY = 'push-owner';

export type PushStatus =
  | 'unavailable' // la app no tiene clave VAPID configurada
  | 'unsupported' // el navegador no permite push
  | 'ios-install' // iPhone/iPad: hay que instalar la app en la pantalla de inicio
  | 'denied' // la persona bloqueó las notificaciones
  | 'off'
  | 'on';

// ---------------------------------------------------------------------------
// Detección
// ---------------------------------------------------------------------------
type NavigatorLike = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { platform?: string };

export function isIos(nav: NavigatorLike = navigator): boolean {
  // iPadOS se presenta como Mac de escritorio, pero con pantalla táctil.
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  );
}

/** ¿Se abrió desde el icono de la pantalla de inicio (PWA instalada)? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Clave pública VAPID (base64url) → bytes, como la pide pushManager.subscribe. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((byte, i) => byte === b[i]);
}

// ---------------------------------------------------------------------------
// Dueño de la suscripción en este navegador (localStorage puede fallar: modo privado, etc.)
// ---------------------------------------------------------------------------
function getOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function setOwner(userId: string) {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* sin almacenamiento: al recargar se tratará como de otra persona y se anulará */
  }
}

function clearOwner() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* nada que limpiar */
  }
}

// ---------------------------------------------------------------------------
// Service worker y suscripción
// ---------------------------------------------------------------------------
/** Registra el service worker (no pide ningún permiso). */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  } catch (error) {
    console.warn('No se pudo registrar el service worker', error);
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function getPushStatus(userId: string): Promise<PushStatus> {
  if (!env.VITE_VAPID_PUBLIC_KEY) return 'unavailable';
  // En iPhone, Safari (sin instalar) no tiene PushManager: primero hay que instalar la app.
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const subscription = await currentSubscription();
  return subscription && getOwner() === userId ? 'on' : 'off';
}

/** Pide permiso, suscribe este navegador y lo guarda en Supabase. */
export async function enablePush(userId: string): Promise<PushStatus> {
  const key = env.VITE_VAPID_PUBLIC_KEY;
  if (!key) return 'unavailable';
  if (!isPushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off'; // cerró el diálogo sin elegir

  await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  const registration = await navigator.serviceWorker.ready;

  // Una suscripción previa puede ser de otra persona o de otra clave VAPID: se empieza de cero.
  const previous = await registration.pushManager.getSubscription();
  if (previous) {
    await deletePushSubscription(previous.endpoint).catch(() => {});
    await previous.unsubscribe().catch(() => {});
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  try {
    await registerPushSubscription(subscription.toJSON(), navigator.userAgent);
  } catch (error) {
    await subscription.unsubscribe().catch(() => {});
    throw error;
  }
  setOwner(userId);
  return 'on';
}

/** Anula la suscripción de este navegador y la borra de Supabase. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (subscription) {
    // Si el borrado falla, la fila caduca sola: el siguiente envío dará 410 y se eliminará.
    await deletePushSubscription(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  }
  clearOwner();
}

/**
 * Al cerrar sesión: este dispositivo deja de recibir avisos de la cuenta. Nunca bloquea el cierre
 * de sesión más de unos segundos.
 */
export async function disablePushOnSignOut(): Promise<void> {
  if (!isPushSupported()) return;
  await Promise.race([
    disablePush().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]);
}

/**
 * Al abrir la app con sesión: renueva la suscripción en Supabase (el navegador puede cambiarla),
 * la vuelve a crear si cambió la clave VAPID y la anula si era de otra persona.
 */
export async function syncPushSubscription(userId: string): Promise<void> {
  const key = env.VITE_VAPID_PUBLIC_KEY;
  if (!key || !isPushSupported() || Notification.permission !== 'granted') return;
  const subscription = await currentSubscription();
  if (!subscription) return;

  if (getOwner() !== userId) {
    await subscription.unsubscribe().catch(() => {});
    clearOwner();
    return;
  }

  const appKey = urlBase64ToUint8Array(key);
  if (sameKey(subscription.options.applicationServerKey, appKey)) {
    await registerPushSubscription(subscription.toJSON(), navigator.userAgent);
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  await deletePushSubscription(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
  const renewed = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appKey,
  });
  await registerPushSubscription(renewed.toJSON(), navigator.userAgent);
}

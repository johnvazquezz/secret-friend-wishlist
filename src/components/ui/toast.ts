/**
 * Notificaciones flotantes que se cierran solas. Estado a nivel de módulo (sin proveedor):
 *   toast.success('Cambios guardados.');
 * Se muestran con <Toaster />, montado en los layouts.
 */

export type ToastTone = 'success' | 'info' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
}

const DURATION = 4000;
const MAX_VISIBLE = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts() {
  return toasts;
}

export function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Programa el cierre automático (se llama de nuevo al quitar el ratón de encima). */
export function scheduleDismiss(id: number, ms = DURATION) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => dismiss(id), ms),
  );
}

export function pauseDismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

function show(tone: ToastTone, message: string, description?: string) {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message, description }].slice(-MAX_VISIBLE);
  emit();
  scheduleDismiss(id, tone === 'error' ? DURATION * 1.5 : DURATION);
  return id;
}

export const toast = {
  success: (message: string, description?: string) => show('success', message, description),
  info: (message: string, description?: string) => show('info', message, description),
  error: (message: string, description?: string) => show('error', message, description),
};

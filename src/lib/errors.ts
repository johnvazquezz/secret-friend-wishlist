const DEFAULT_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Error cuyo mensaje ya está pensado para mostrarse al usuario. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/** Mensajes de las excepciones de negocio lanzadas por las funciones de la base de datos. */
const DB_ERROR_MESSAGES: Record<string, string> = {
  not_admin: 'Solo un administrador puede hacer esto.',
  event_not_found: 'El evento no existe.',
  invalid_event_status: 'Esta acción no está disponible en el estado actual del evento.',
  not_enough_participants: 'Hacen falta al menos 3 participantes confirmados para sortear.',
  draw_impossible:
    'Con las exclusiones actuales no hay un sorteo posible. Quita alguna exclusión e inténtalo de nuevo.',
  not_invited: 'Esta persona no está en la lista de participantes.',
  registration_closed: 'El plazo para confirmar la participación ya terminó.',
  wishlist_limit: 'Llegaste al máximo de 20 deseos.',
  chat_closed: 'El chat solo está abierto mientras el sorteo está publicado.',
  no_thread: 'No tienes acceso a esta conversación.',
  invalid_message: 'El mensaje debe tener entre 1 y 1000 caracteres.',
  rate_limited: 'Estás enviando mensajes muy rápido. Espera un momento.',
  invalid_announcement:
    'El aviso necesita un título (máx. 120) y un texto de hasta 1000 caracteres.',
};

const PG_ERROR_MESSAGES: Record<string, string> = {
  '42501': 'No tienes permiso para hacer esto.',
  '23505': 'Ese registro ya existe.',
};

function asRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
}

/** Convierte cualquier error (Supabase, red, código) en un mensaje legible en español. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }
  const record = asRecord(error);
  if (record) {
    const message = typeof record.message === 'string' ? record.message : '';
    if (DB_ERROR_MESSAGES[message]) return DB_ERROR_MESSAGES[message];
    const code = typeof record.code === 'string' ? record.code : '';
    if (PG_ERROR_MESSAGES[code]) return PG_ERROR_MESSAGES[code];
  }
  return DEFAULT_MESSAGE;
}

const DEFAULT_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Error cuyo mensaje ya está pensado para mostrarse al usuario. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/** Convierte cualquier error (Supabase, red, código) en un mensaje legible en español. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }
  return DEFAULT_MESSAGE;
}

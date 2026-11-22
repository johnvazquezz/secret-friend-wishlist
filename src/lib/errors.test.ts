import { describe, expect, it } from 'vitest';
import { AppError, getErrorMessage, isRateLimitError, RateLimitError } from './errors';

describe('getErrorMessage', () => {
  it('usa el mensaje de AppError', () => {
    expect(getErrorMessage(new AppError('Hola'))).toBe('Hola');
  });

  it('traduce las excepciones de negocio de la base de datos', () => {
    expect(getErrorMessage({ message: 'draw_impossible', code: 'P0001' })).toMatch(/exclusiones/);
  });

  it('traduce códigos de Postgres conocidos', () => {
    expect(getErrorMessage({ message: 'permission denied', code: '42501' })).toBe(
      'No tienes permiso para hacer esto.',
    );
  });

  it('explica el límite de peticiones (HTTP 429) de Supabase', () => {
    const authError = {
      status: 429,
      code: 'over_request_rate_limit',
      message: 'Request rate limit reached',
    };
    expect(isRateLimitError(authError)).toBe(true);
    expect(getErrorMessage(authError)).toMatch(/mucha gente entrando a la vez/);
    expect(getErrorMessage(new RateLimitError())).toMatch(/Espera un minuto/);
  });

  it('no confunde el límite de mensajes del chat con el de Supabase', () => {
    expect(isRateLimitError({ message: 'rate_limited', code: 'P0001' })).toBe(false);
    expect(getErrorMessage({ message: 'rate_limited', code: 'P0001' })).toMatch(/muy rápido/);
  });

  it('nunca muestra mensajes técnicos desconocidos', () => {
    expect(getErrorMessage(new Error('relation "x" does not exist'))).toMatch(/inesperado/);
  });
});

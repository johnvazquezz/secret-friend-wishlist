import { describe, expect, it } from 'vitest';
import { AppError, getErrorMessage } from './errors';

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

  it('nunca muestra mensajes técnicos desconocidos', () => {
    expect(getErrorMessage(new Error('relation "x" does not exist'))).toMatch(/inesperado/);
  });
});

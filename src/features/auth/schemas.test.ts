import { describe, expect, it } from 'vitest';
import { newPasswordSchema } from './schemas';

describe('newPasswordSchema', () => {
  it.each([
    ['corta1', 'Mínimo 10 caracteres'],
    ['solamenteletras', 'Debe incluir al menos un número'],
    ['1234567890', 'Debe incluir al menos una letra'],
  ])('rechaza "%s"', (password, message) => {
    const result = newPasswordSchema.safeParse({ password, confirm: password });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });

  it('exige que la confirmación coincida', () => {
    const result = newPasswordSchema.safeParse({ password: 'Navidad2026', confirm: 'Navidad2025' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['confirm'] });
  });

  it('acepta una contraseña válida', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'Navidad2026', confirm: 'Navidad2026' }).success,
    ).toBe(true);
  });
});

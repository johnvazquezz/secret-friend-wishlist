import { describe, expect, it } from 'vitest';
import { computeCountdown, formatMoney, fromDateTimeLocal, toDateTimeLocal } from './format';

describe('computeCountdown', () => {
  const now = new Date('2026-12-01T10:00:00Z');

  it('calcula días, horas y minutos', () => {
    expect(computeCountdown(new Date('2026-12-03T12:30:59Z'), now)).toEqual({
      days: 2,
      hours: 2,
      minutes: 30,
      isPast: false,
    });
  });

  it('marca como pasado cuando la fecha ya llegó', () => {
    expect(computeCountdown(new Date('2026-12-01T09:59:00Z'), now).isPast).toBe(true);
  });
});

describe('formatMoney', () => {
  it('formatea monedas ISO', () => {
    expect(formatMoney(25, 'USD')).toMatch(/25/);
  });

  it('no falla con códigos no ISO', () => {
    expect(formatMoney(25, 'bolívares')).toBe('25 bolívares');
  });
});

describe('datetime-local', () => {
  it('ida y vuelta conserva el instante', () => {
    const iso = '2026-12-20T23:30:00.000Z';
    expect(fromDateTimeLocal(toDateTimeLocal(iso))).toBe(iso);
  });

  it('vacío ↔ null', () => {
    expect(toDateTimeLocal(null)).toBe('');
    expect(fromDateTimeLocal('')).toBeNull();
  });
});

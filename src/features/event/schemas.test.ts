import { describe, expect, it } from 'vitest';
import { parseEventForm, type EventFormValues } from './schemas';

const base: EventFormValues = {
  name: 'Navidad 2026',
  description: '',
  rules: '',
  budget_amount: '25',
  currency: 'USD',
  location: '',
  registration_deadline: '',
  exchange_at: '',
};

describe('parseEventForm', () => {
  it('convierte vacíos en null y el presupuesto en número', () => {
    const result = parseEventForm(base);
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        name: 'Navidad 2026',
        description: null,
        budget_amount: 25,
        registration_deadline: null,
      }),
    });
  });

  it('exige nombre', () => {
    expect(parseEventForm({ ...base, name: '  ' })).toEqual({
      ok: false,
      error: 'El nombre es obligatorio',
    });
  });

  it('rechaza presupuestos negativos o no numéricos', () => {
    expect(parseEventForm({ ...base, budget_amount: '-1' }).ok).toBe(false);
    expect(parseEventForm({ ...base, budget_amount: 'mucho' }).ok).toBe(false);
  });

  it('la inscripción debe cerrar antes del intercambio', () => {
    const result = parseEventForm({
      ...base,
      registration_deadline: '2026-12-20T10:00',
      exchange_at: '2026-12-19T10:00',
    });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/anterior al intercambio/) });
  });
});

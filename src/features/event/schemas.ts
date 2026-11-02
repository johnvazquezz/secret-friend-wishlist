import { z } from 'zod';
import { fromDateTimeLocal } from '../../lib/format';
import type { EventInput } from './api';

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres`)
    .transform((value) => (value === '' ? null : value));

export const eventFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Nombre demasiado largo'),
    description: optionalText(2000, 'Descripción'),
    rules: optionalText(4000, 'Reglas'),
    budget_amount: z
      .string()
      .trim()
      .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: 'El presupuesto debe ser un número positivo',
      })
      .transform((v) => (v === '' ? null : Number(v))),
    currency: z.string().trim().min(1, 'Indica la moneda').max(8, 'Moneda demasiado larga'),
    location: optionalText(200, 'Lugar'),
    registration_deadline: z.string().transform(fromDateTimeLocal),
    exchange_at: z.string().transform(fromDateTimeLocal),
  })
  .refine(
    (data) =>
      !data.registration_deadline ||
      !data.exchange_at ||
      data.registration_deadline <= data.exchange_at,
    {
      path: ['registration_deadline'],
      message: 'La fecha límite de inscripción debe ser anterior al intercambio',
    },
  );

export type EventFormValues = z.input<typeof eventFormSchema>;

export function parseEventForm(
  values: EventFormValues,
): { ok: true; data: EventInput } | { ok: false; error: string } {
  const parsed = eventFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}

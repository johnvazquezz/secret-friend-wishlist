import { z } from 'zod';
import type { Preferences, WishlistItemInput } from './api';

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v));

export const wishlistItemSchema = z.object({
  title: z.string().trim().min(1, '¿Qué te gustaría?').max(120, 'Máximo 120 caracteres'),
  notes: optional(500, 'Detalles'),
  priority: z
    .string()
    .regex(/^[123]$/, 'Prioridad inválida')
    .transform(Number),
});

export type WishlistItemFormValues = z.input<typeof wishlistItemSchema>;

export function parseWishlistItem(
  values: WishlistItemFormValues,
): { ok: true; data: WishlistItemInput } | { ok: false; error: string } {
  const parsed = wishlistItemSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}

export const preferencesSchema = z.object({
  likes: optional(1000, 'Me gusta'),
  dislikes: optional(1000, 'No me gusta'),
  sizes: optional(300, 'Tallas'),
  allergies: optional(300, 'Alergias'),
  notes: optional(1000, 'Otros'),
});

export type PreferencesFormValues = z.input<typeof preferencesSchema>;

export function parsePreferences(
  values: PreferencesFormValues,
): { ok: true; data: Preferences } | { ok: false; error: string } {
  const parsed = preferencesSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Me encantaría',
  2: 'Me gustaría',
  3: 'Si te sobra presupuesto',
};

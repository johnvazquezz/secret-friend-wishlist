import { z } from 'zod';

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'Nombre demasiado largo'),
  department: z
    .string()
    .trim()
    .max(120, 'Departamento demasiado largo')
    .transform((value) => (value === '' ? null : value)),
});

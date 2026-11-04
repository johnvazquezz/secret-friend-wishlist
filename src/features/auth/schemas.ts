import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Introduce un email válido'),
  password: z.string().min(1, 'Introduce tu contraseña'),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Mínimo 10 caracteres')
      .regex(/[A-Za-z]/, 'Debe incluir al menos una letra')
      .regex(/\d/, 'Debe incluir al menos un número'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden',
  });

/** Primer mensaje de error por campo, para pintar bajo cada input. */
export function fieldErrors<T extends string>(error: z.ZodError): Partial<Record<T, string>> {
  const result: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as T;
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}

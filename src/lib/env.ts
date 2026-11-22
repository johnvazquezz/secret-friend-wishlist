import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL debe ser una URL válida'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY es obligatoria'),
  // Opcional: sin ella, la opción de notificaciones push no aparece.
  VITE_VAPID_PUBLIC_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{80,100}$/, 'VITE_VAPID_PUBLIC_KEY no parece una clave pública VAPID')
      .optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `- ${issue.message}`).join('\n');
    throw new Error(
      `Configuración de entorno inválida. Revisa tu archivo .env (ver .env.template):\n${details}`,
    );
  }
  return result.data;
}

export const env = parseEnv(import.meta.env);

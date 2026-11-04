import { z } from 'zod';

export interface NewUser {
  full_name: string;
  email: string;
  department: string | null;
}

export interface ParsedLine {
  line: number;
  raw: string;
  user?: NewUser;
  error?: string;
}

const emailSchema = z.string().email();

/**
 * Convierte texto pegado (una persona por línea) en usuarios.
 * Formatos aceptados por línea, con separador `;`, tabulador (copiado de Excel) o `,`:
 *   Nombre; email
 *   Nombre; email; Departamento
 * El orden nombre/email se detecta automáticamente.
 */
export function parseBulkUsers(text: string): ParsedLine[] {
  const seen = new Set<string>();
  const result: ParsedLine[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const line = index + 1;

    const separator = /[;\t]/.test(trimmed) ? /[;\t]/ : /,/;
    const parts = trimmed
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);

    const emailIndex = parts.findIndex((part) => part.includes('@'));
    if (emailIndex === -1) {
      result.push({ line, raw, error: 'Falta el email' });
      return;
    }
    const email = parts[emailIndex].toLowerCase();
    const others = parts.filter((_, i) => i !== emailIndex);
    const [fullName, department] = others;

    if (!emailSchema.safeParse(email).success) {
      result.push({ line, raw, error: `Email inválido: ${email}` });
    } else if (!fullName) {
      result.push({ line, raw, error: 'Falta el nombre' });
    } else if (fullName.length > 120 || (department?.length ?? 0) > 120) {
      result.push({ line, raw, error: 'Texto demasiado largo' });
    } else if (seen.has(email)) {
      result.push({ line, raw, error: 'Email repetido en la lista' });
    } else {
      seen.add(email);
      result.push({
        line,
        raw,
        user: { full_name: fullName, email, department: department ?? null },
      });
    }
  });

  return result;
}

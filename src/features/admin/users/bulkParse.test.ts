import { describe, expect, it } from 'vitest';
import { parseBulkUsers } from './bulkParse';

describe('parseBulkUsers', () => {
  it('acepta varios separadores y detecta el email en cualquier posición', () => {
    const result = parseBulkUsers(
      [
        'Ana Pérez; ana@empresa.com; Finanzas',
        'luis@empresa.com\tLuis Gómez',
        'María López, Maria@Empresa.com',
      ].join('\n'),
    );
    expect(result.map((r) => r.user)).toEqual([
      { full_name: 'Ana Pérez', email: 'ana@empresa.com', department: 'Finanzas' },
      { full_name: 'Luis Gómez', email: 'luis@empresa.com', department: null },
      { full_name: 'María López', email: 'maria@empresa.com', department: null },
    ]);
  });

  it('ignora líneas vacías y reporta errores con su número de línea', () => {
    const result = parseBulkUsers(
      '\nSin Email\nana@empresa.com\nX; no-es-email@\nAna; ana@e.com\nAna 2; ANA@e.com',
    );
    expect(result).toEqual([
      expect.objectContaining({ line: 2, error: 'Falta el email' }),
      expect.objectContaining({ line: 3, error: 'Falta el nombre' }),
      expect.objectContaining({ line: 4, error: expect.stringMatching(/Email inválido/) }),
      expect.objectContaining({ line: 5, user: expect.any(Object) }),
      expect.objectContaining({ line: 6, error: 'Email repetido en la lista' }),
    ]);
  });
});

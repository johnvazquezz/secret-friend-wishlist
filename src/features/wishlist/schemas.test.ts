import { describe, expect, it } from 'vitest';
import { parsePreferences, parseWishlistItem } from './schemas';

const base = { title: 'Libro', notes: '', priority: '2' };

describe('parseWishlistItem', () => {
  it('normaliza vacíos y la prioridad', () => {
    expect(parseWishlistItem(base)).toEqual({
      ok: true,
      data: { title: 'Libro', notes: null, priority: 2 },
    });
  });

  it('exige título', () => {
    expect(parseWishlistItem({ ...base, title: ' ' }).ok).toBe(false);
  });

  it('rechaza prioridades fuera de 1–3', () => {
    expect(parseWishlistItem({ ...base, priority: '7' }).ok).toBe(false);
  });
});

describe('parsePreferences', () => {
  it('convierte campos vacíos en null', () => {
    expect(
      parsePreferences({ likes: 'Café', dislikes: '', sizes: ' M ', allergies: '', notes: '' }),
    ).toEqual({
      ok: true,
      data: { likes: 'Café', dislikes: null, sizes: 'M', allergies: null, notes: null },
    });
  });
});

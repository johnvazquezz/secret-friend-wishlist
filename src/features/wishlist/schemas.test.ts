import { describe, expect, it } from 'vitest';
import { isSafeUrl, parsePreferences, parseWishlistItem } from './schemas';

const base = { title: 'Libro', url: '', notes: '', price_hint: '', priority: '2' };

describe('isSafeUrl', () => {
  it.each([
    ['https://tienda.com/x', true],
    ['http://tienda.com', true],
    ['javascript:alert(1)', false],
    ['data:text/html,hola', false],
    ['tienda.com', false],
  ])('%s → %s', (url, expected) => {
    expect(isSafeUrl(url)).toBe(expected);
  });
});

describe('parseWishlistItem', () => {
  it('normaliza vacíos y números', () => {
    expect(parseWishlistItem({ ...base, price_hint: '15.5' })).toEqual({
      ok: true,
      data: { title: 'Libro', url: null, notes: null, price_hint: 15.5, priority: 2 },
    });
  });

  it('rechaza enlaces peligrosos', () => {
    expect(parseWishlistItem({ ...base, url: 'javascript:alert(1)' })).toEqual({
      ok: false,
      error: 'El enlace debe empezar por https://',
    });
  });

  it('exige título', () => {
    expect(parseWishlistItem({ ...base, title: ' ' }).ok).toBe(false);
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

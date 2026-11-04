import { describe, expect, it } from 'vitest';
import { computeSquareCrop, validateImageFile } from './image';

describe('computeSquareCrop', () => {
  it('recorta al centro una imagen horizontal', () => {
    expect(computeSquareCrop(400, 200)).toEqual({ sx: 100, sy: 0, size: 200 });
  });

  it('recorta al centro una imagen vertical', () => {
    expect(computeSquareCrop(300, 501)).toEqual({ sx: 0, sy: 100, size: 300 });
  });

  it('no recorta una imagen cuadrada', () => {
    expect(computeSquareCrop(256, 256)).toEqual({ sx: 0, sy: 0, size: 256 });
  });
});

describe('validateImageFile', () => {
  it('rechaza archivos que no son imagen', () => {
    expect(validateImageFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toMatch(
      /imagen/,
    );
  });

  it('acepta imágenes', () => {
    expect(validateImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
  });
});

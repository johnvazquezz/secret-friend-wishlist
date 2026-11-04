import { describe, expect, it } from 'vitest';
import { getInitials } from './text';

describe('getInitials', () => {
  it.each([
    ['Ana María Pérez', 'AP'],
    ['luis', 'L'],
    ['  ', '?'],
  ])('%s → %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

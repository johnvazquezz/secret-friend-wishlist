import { describe, expect, it } from 'vitest';
import type { Message } from './api';
import { appendMessage, isChatAvailable } from './hooks';

const msg = (id: string, created_at: string): Message => ({
  id,
  thread_id: 't',
  author_role: 'giver',
  body: id,
  created_at,
  read_at: null,
});

describe('appendMessage', () => {
  it('añade en orden cronológico', () => {
    const list = [msg('a', '2026-12-01T10:00:00Z'), msg('c', '2026-12-01T10:02:00Z')];
    expect(appendMessage(list, msg('b', '2026-12-01T10:01:00Z'))?.map((m) => m.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('no duplica un mensaje ya presente', () => {
    const list = [msg('a', '2026-12-01T10:00:00Z')];
    expect(appendMessage(list, msg('a', '2026-12-01T10:00:00Z'))).toBe(list);
  });

  it('no crea la caché si aún no se cargó', () => {
    expect(appendMessage(undefined, msg('a', '2026-12-01T10:00:00Z'))).toBeUndefined();
  });
});

describe('isChatAvailable', () => {
  it('solo con el sorteo publicado o finalizado', () => {
    expect(isChatAvailable('open')).toBe(false);
    expect(isChatAvailable('drawn')).toBe(false);
    expect(isChatAvailable('published')).toBe(true);
    expect(isChatAvailable('finished')).toBe(true);
  });
});

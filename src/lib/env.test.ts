import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('acepta una configuración válida', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'key',
    });
    expect(env.VITE_SUPABASE_URL).toBe('https://abc.supabase.co');
  });

  it('falla con un mensaje claro si faltan variables', () => {
    expect(() => parseEnv({})).toThrow(/Configuración de entorno inválida/);
  });

  it('la clave VAPID es opcional (vacía cuenta como ausente)', () => {
    const base = { VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' };
    expect(parseEnv(base).VITE_VAPID_PUBLIC_KEY).toBeUndefined();
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: '' }).VITE_VAPID_PUBLIC_KEY).toBeUndefined();
    const key = 'B' + 'a'.repeat(86);
    expect(parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: key }).VITE_VAPID_PUBLIC_KEY).toBe(key);
    expect(() => parseEnv({ ...base, VITE_VAPID_PUBLIC_KEY: 'privada?' })).toThrow(/VAPID/);
  });

  it('rechaza una URL inválida', () => {
    expect(() =>
      parseEnv({ VITE_SUPABASE_URL: 'no-es-url', VITE_SUPABASE_ANON_KEY: 'key' }),
    ).toThrow(/URL válida/);
  });
});

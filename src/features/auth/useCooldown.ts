import { useCallback, useEffect, useState } from 'react';

/**
 * Cuenta atrás en segundos para bloquear un botón tras un error de límite de peticiones,
 * y así evitar reintentos en cadena que alargan el bloqueo.
 */
export function useCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  const start = useCallback((seconds: number) => setSecondsLeft(seconds), []);

  return { secondsLeft, coolingDown: secondsLeft > 0, start };
}

import { useEffect, useState } from 'react';
import { computeCountdown } from '../../lib/format';

interface CountdownDisplayProps {
  target: string;
}

/** Cuenta regresiva hasta una fecha. Se actualiza cada minuto. */
export default function CountdownDisplay({ target }: CountdownDisplayProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { days, hours, minutes, isPast } = computeCountdown(new Date(target), now);

  if (isPast) {
    return (
      <p className="font-display text-2xl font-semibold text-primary-700">
        ¡Hoy es el intercambio! 🎁
      </p>
    );
  }

  const parts = [
    { value: days, label: days === 1 ? 'día' : 'días' },
    { value: hours, label: hours === 1 ? 'hora' : 'horas' },
    { value: minutes, label: minutes === 1 ? 'minuto' : 'minutos' },
  ];

  return (
    <div
      className="inline-flex items-stretch gap-2 sm:gap-3"
      aria-label="Cuenta regresiva para el intercambio"
    >
      {parts.map((part) => (
        <div
          key={part.label}
          className="rounded-xl bg-white/80 ring-1 ring-primary-100 px-3 sm:px-5 py-3 min-w-[4.5rem] text-center"
        >
          <div className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tabular-nums leading-none">
            {part.value}
          </div>
          <div className="text-xs font-medium text-stone-500 mt-1.5">{part.label}</div>
        </div>
      ))}
    </div>
  );
}

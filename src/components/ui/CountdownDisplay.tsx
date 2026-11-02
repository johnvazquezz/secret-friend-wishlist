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
    return <p className="text-xl font-semibold text-primary">¡Hoy es el intercambio! 🎁</p>;
  }

  const parts = [
    { value: days, label: days === 1 ? 'día' : 'días' },
    { value: hours, label: hours === 1 ? 'hora' : 'horas' },
    { value: minutes, label: minutes === 1 ? 'minuto' : 'minutos' },
  ];

  return (
    <div className="flex justify-center gap-3" aria-label="Cuenta regresiva para el intercambio">
      {parts.map((part) => (
        <div key={part.label} className="bg-white rounded-xl shadow px-4 py-3 min-w-20 text-center">
          <div className="text-3xl font-bold text-primary tabular-nums">{part.value}</div>
          <div className="text-sm text-gray-600">{part.label}</div>
        </div>
      ))}
    </div>
  );
}

interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = 'Cargando...' }: SpinnerProps) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
      <div
        aria-hidden="true"
        className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary-100 border-t-primary-600"
      />
      <p className="text-stone-500 text-sm">{label}</p>
    </div>
  );
}

/** Bloque gris animado para reservar el espacio mientras carga. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded-lg bg-stone-200/70 ${className}`}
    />
  );
}

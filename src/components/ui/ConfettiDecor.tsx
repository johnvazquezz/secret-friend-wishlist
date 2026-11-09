/** Confeti estático decorativo (papelitos y puntos) para fondos festivos. */
const PIECES = [
  { top: '12%', left: '6%', color: 'bg-amber-300', shape: 'w-2.5 h-1 rotate-12' },
  { top: '22%', left: '18%', color: 'bg-primary-300', shape: 'w-1.5 h-1.5 rounded-full' },
  { top: '70%', left: '9%', color: 'bg-emerald-300', shape: 'w-2.5 h-1 -rotate-45' },
  { top: '84%', left: '24%', color: 'bg-sky-300', shape: 'w-2 h-2 rounded-full' },
  { top: '8%', left: '72%', color: 'bg-sky-300', shape: 'w-2.5 h-1 rotate-45' },
  { top: '30%', left: '90%', color: 'bg-primary-400', shape: 'w-3 h-1 -rotate-12' },
  { top: '62%', left: '86%', color: 'bg-amber-300', shape: 'w-1.5 h-1.5 rounded-full' },
  { top: '88%', left: '70%', color: 'bg-primary-300', shape: 'w-2.5 h-1 rotate-[70deg]' },
  { top: '46%', left: '3%', color: 'bg-primary-200', shape: 'w-1.5 h-1.5 rounded-full' },
  { top: '50%', left: '96%', color: 'bg-emerald-300', shape: 'w-2 h-1 rotate-[30deg]' },
];

export default function ConfettiDecor({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`absolute rounded-[1px] opacity-80 ${p.color} ${p.shape}`}
          style={{ top: p.top, left: p.left }}
        />
      ))}
    </div>
  );
}

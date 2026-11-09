import { getInitials } from '../../lib/text';

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-24 h-24 text-3xl',
  xl: 'w-32 h-32 text-4xl',
} as const;

// Tonos suaves para las iniciales: cada persona tiene siempre el mismo.
const tones = [
  'bg-primary-100 text-primary-800',
  'bg-amber-100 text-amber-900',
  'bg-emerald-100 text-emerald-900',
  'bg-sky-100 text-sky-900',
  'bg-violet-100 text-violet-900',
  'bg-rose-100 text-rose-900',
];

function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return tones[Math.abs(hash) % tones.length];
}

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export default function Avatar({ name, url, size = 'md', className = '' }: AvatarProps) {
  const base = `${sizes[size]} rounded-full shrink-0 ${className}`;
  if (url) {
    return (
      <img
        src={url}
        alt={`Foto de ${name}`}
        className={`${base} object-cover bg-stone-100 ring-1 ring-black/5`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`Iniciales de ${name}`}
      className={`${base} inline-flex items-center justify-center font-semibold font-display ${toneFor(name)}`}
    >
      {getInitials(name)}
    </span>
  );
}

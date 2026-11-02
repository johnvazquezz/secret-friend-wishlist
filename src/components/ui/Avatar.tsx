import { getInitials } from '../../lib/text';

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-24 h-24 text-3xl',
} as const;

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export default function Avatar({ name, url, size = 'md', className = '' }: AvatarProps) {
  const base = `${sizes[size]} rounded-full shrink-0 ${className}`;
  if (url) {
    return <img src={url} alt={`Foto de ${name}`} className={`${base} object-cover bg-gray-100`} />;
  }
  return (
    <span
      role="img"
      aria-label={`Iniciales de ${name}`}
      className={`${base} inline-flex items-center justify-center bg-primary-light text-white font-semibold`}
    >
      {getInitials(name)}
    </span>
  );
}

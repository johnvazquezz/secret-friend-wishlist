import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div' | 'li';
  padded?: boolean;
}

/** Superficie base de la app: blanca, borde fino y sombra sutil. */
export default function Card({
  as: Tag = 'section',
  padded = true,
  className = '',
  ...props
}: CardProps) {
  return <Tag className={`card ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...props} />;
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Cabecera de tarjeta: icono opcional, título (h2), descripción y acciones a la derecha. */
export function CardHeader({ title, description, icon, actions, className = '' }: CardHeaderProps) {
  return (
    <div
      className={`flex flex-wrap gap-3 mb-5 ${description ? 'items-start' : 'items-center'} ${className}`}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 inline-flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5"
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-stone-900 leading-tight">{title}</h2>
        {description && <p className="text-sm text-stone-600 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

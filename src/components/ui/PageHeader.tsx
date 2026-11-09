import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Cabecera común de página: antetítulo, h1, descripción y acciones. */
export default function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-4 mb-8 ${className}`}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-900">{title}</h1>
        {description && <div className="mt-2 text-stone-600 text-base">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

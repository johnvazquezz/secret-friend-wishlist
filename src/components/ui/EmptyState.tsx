import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: ReactNode;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  message,
  title,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 inline-flex items-center justify-center mb-4 [&>svg]:w-7 [&>svg]:h-7"
        >
          {icon}
        </span>
      )}
      {title && <h2 className="text-xl font-semibold text-stone-900 mb-1">{title}</h2>}
      <p className="text-stone-600 max-w-md mx-auto">{message}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

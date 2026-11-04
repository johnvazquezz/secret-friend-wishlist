import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="text-center mb-8">
      <p className="text-gray-600 mb-4">{message}</p>
      {action}
    </div>
  );
}

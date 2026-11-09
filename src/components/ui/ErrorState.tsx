import { AlertTriangle, RotateCw } from 'lucide-react';
import Button from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  message,
  onRetry,
  retryLabel = 'Reintentar',
}: ErrorStateProps) {
  return (
    <div role="alert" className="card max-w-md mx-auto p-8 text-center">
      <span
        aria-hidden="true"
        className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 inline-flex items-center justify-center mb-4"
      >
        <AlertTriangle className="w-6 h-6" />
      </span>
      <p className="text-stone-700 mb-6">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw aria-hidden="true" className="w-4 h-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

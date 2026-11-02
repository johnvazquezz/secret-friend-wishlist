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
    <div
      role="alert"
      className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 text-center border-2 border-red-100"
    >
      <AlertTriangle aria-hidden="true" className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <p className="text-gray-700 mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <RotateCw aria-hidden="true" className="w-5 h-5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

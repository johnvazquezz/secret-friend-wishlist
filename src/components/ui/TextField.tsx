import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export default function TextField({
  label,
  error,
  hint,
  className = '',
  ...props
}: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-stone-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`input-base h-11 py-0 ${
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''
        }`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600 mt-1.5">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-stone-500 mt-1.5">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

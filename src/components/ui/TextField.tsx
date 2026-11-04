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
      <label htmlFor={id} className="block text-gray-700 font-medium mb-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full px-4 py-3 border-2 rounded-lg focus:border-primary focus:outline-none ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600 mt-1">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-gray-500 mt-1">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

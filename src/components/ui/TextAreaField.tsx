import { useId, type TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export default function TextAreaField({
  label,
  hint,
  className = '',
  ...props
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-stone-700 mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="input-base min-h-24"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-stone-500 mt-1.5">
          {hint}
        </p>
      )}
    </div>
  );
}

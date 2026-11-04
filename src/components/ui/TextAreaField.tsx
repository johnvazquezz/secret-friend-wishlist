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
      <label htmlFor={id} className="block text-gray-700 font-medium mb-2">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none min-h-24"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-gray-500 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

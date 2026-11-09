import { createPortal } from 'react-dom';
import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal accesible. En móvil se muestra como hoja inferior. Cierra con Esc y atrapa el foco. */
export default function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, onClose);

  // Portal al body: así ningún contenedor (p. ej. space-y-*) le añade márgenes.
  return createPortal(
    <div
      className="fixed inset-0 bg-stone-900/45 flex items-end sm:items-center justify-center sm:p-4 z-50 motion-safe:animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-lift ring-1 ring-stone-900/5 motion-safe:animate-pop-in"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-stone-200 px-5 sm:px-6 py-4 flex justify-between items-center gap-4">
          <h2 id={titleId} className="text-xl font-semibold text-stone-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 p-2 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, PartyPopper } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import Button from './Button';
import { useDialogFocus } from './useDialogFocus';

export type ConfirmTone = 'default' | 'danger' | 'celebrate';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

const toneStyles: Record<ConfirmTone, { icon: ReactNode; badge: string }> = {
  default: {
    icon: <HelpCircle className="w-6 h-6" />,
    badge: 'bg-primary-50 text-primary-600 ring-primary-100',
  },
  danger: {
    icon: <AlertTriangle className="w-6 h-6" />,
    badge: 'bg-red-50 text-red-600 ring-red-100',
  },
  celebrate: {
    icon: <PartyPopper className="w-6 h-6" />,
    badge: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
};

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación de la app (sustituye a `window.confirm`). */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // En acciones destructivas el foco empieza en "Cancelar" para evitar errores con Enter.
  useDialogFocus(dialogRef, onCancel, tone === 'danger' ? cancelRef : confirmRef);
  const style = toneStyles[tone];

  // Portal al body: así ningún contenedor (p. ej. space-y-*) le añade márgenes.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-stone-900/45 p-4 motion-safe:animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="w-full max-w-md rounded-3xl sm:rounded-2xl bg-white p-6 shadow-lift ring-1 ring-stone-900/5 motion-safe:animate-pop-in"
      >
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className={`w-12 h-12 shrink-0 rounded-2xl ring-1 ring-inset inline-flex items-center justify-center ${style.badge}`}
          >
            {style.icon}
          </span>
          <div className="min-w-0 pt-1">
            <h2 id={titleId} className="text-lg font-semibold text-stone-900 leading-snug">
              {title}
            </h2>
            {message && (
              <div id={messageId} className="mt-2 text-sm text-stone-600 whitespace-pre-line">
                {message}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'dangerSolid' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

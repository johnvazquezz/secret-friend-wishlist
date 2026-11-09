import { useCallback, useState } from 'react';
import ConfirmDialog, { type ConfirmOptions } from './ConfirmDialog';

/**
 * Confirmación basada en promesas, sin proveedor global:
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: '¿Seguro?' }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? (
    <ConfirmDialog {...pending} onConfirm={() => close(true)} onCancel={() => close(false)} />
  ) : null;

  return [confirm, dialog] as const;
}

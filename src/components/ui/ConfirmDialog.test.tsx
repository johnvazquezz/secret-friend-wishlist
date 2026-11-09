import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useConfirm } from './useConfirm';

function Harness() {
  const [confirm, dialog] = useConfirm();
  const [result, setResult] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={async () =>
          setResult(
            String(await confirm({ title: '¿Borrar?', confirmLabel: 'Borrar', tone: 'danger' })),
          )
        }
      >
        Abrir
      </button>
      <output>{result}</output>
      {dialog}
    </>
  );
}

describe('useConfirm', () => {
  it('resuelve true al confirmar y cierra el diálogo', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('alertdialog', { name: '¿Borrar?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('true');
  });

  it('resuelve false con Esc; en acciones peligrosas el foco empieza en Cancelar', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });
});

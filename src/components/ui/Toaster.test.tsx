import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from './toast';
import Toaster from './Toaster';

describe('Toaster', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra la notificación y la cierra sola', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success('Cambios guardados.');
    });
    expect(screen.getByRole('region', { name: 'Avisos' })).toHaveTextContent('Cambios guardados.');
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText('Cambios guardados.')).not.toBeInTheDocument();
  });

  it('se puede cerrar a mano', async () => {
    render(<Toaster />);
    act(() => {
      toast.info('Hola');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(screen.queryByText('Hola')).not.toBeInTheDocument();
  });
});

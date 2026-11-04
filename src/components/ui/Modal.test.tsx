import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('es un diálogo accesible con título', () => {
    render(
      <Modal title="Mi tarjeta" onClose={() => {}}>
        <input aria-label="campo" />
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Mi tarjeta' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('se cierra con Esc y con el botón cerrar', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Mi tarjeta" onClose={onClose}>
        contenido
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('mantiene el foco dentro del diálogo', async () => {
    render(
      <Modal title="Mi tarjeta" onClose={() => {}}>
        <input aria-label="campo" />
      </Modal>,
    );
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const input = screen.getByRole('textbox', { name: 'campo' });
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
  });
});

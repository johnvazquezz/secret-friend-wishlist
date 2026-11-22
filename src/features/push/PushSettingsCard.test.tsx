import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { disablePush, enablePush, getPushStatus } from './browser';
import PushPromptBanner from './PushPromptBanner';
import PushSettingsCard from './PushSettingsCard';

vi.mock('./browser', () => ({
  getPushStatus: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn().mockResolvedValue(undefined),
  syncPushSubscription: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(enablePush).mockReset();
  vi.mocked(disablePush).mockClear();
});

describe('PushSettingsCard', () => {
  it('no aparece si la app no tiene push configurado', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('unavailable');
    const { container } = render(<PushSettingsCard userId="u1" />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('activa con un clic (el permiso se pide solo al pulsar)', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('off');
    vi.mocked(enablePush).mockResolvedValue('on');
    render(<PushSettingsCard userId="u1" />);
    expect(enablePush).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', { name: 'Activar notificaciones' }));
    expect(enablePush).toHaveBeenCalledWith('u1');
    expect(await screen.findByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.getByText('Activadas en este dispositivo.')).toBeInTheDocument();
  });

  it('desactiva', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('on');
    render(<PushSettingsCard userId="u1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    expect(disablePush).toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: 'Activar notificaciones' }),
    ).toBeInTheDocument();
  });

  it('explica cómo desbloquear si el permiso está denegado', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('denied');
    render(<PushSettingsCard userId="u1" />);
    expect(await screen.findByText(/Bloqueaste las notificaciones/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('en iPhone sin instalar muestra la guía', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('ios-install');
    render(<PushSettingsCard userId="u1" />);
    expect(await screen.findByText(/Añadir a pantalla de inicio/)).toBeInTheDocument();
  });
});

describe('PushPromptBanner', () => {
  it('ofrece activar y se puede cerrar para siempre', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('off');
    const { unmount } = render(<PushPromptBanner userId="u1" />);
    expect(await screen.findByText(/¿Te avisamos cuando te escriban\?/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText(/¿Te avisamos/)).not.toBeInTheDocument();

    unmount();
    render(<PushPromptBanner userId="u1" />);
    await vi.waitFor(() => expect(getPushStatus).toHaveBeenCalled());
    expect(screen.queryByText(/¿Te avisamos/)).not.toBeInTheDocument();
  });

  it('en iPhone enseña los pasos para instalar', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('ios-install');
    render(<PushPromptBanner userId="u1" />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver cómo activarlas en iPhone' }),
    );
    expect(screen.getByText(/Añadir a pantalla de inicio/)).toBeInTheDocument();
  });

  it('no aparece si ya están activadas', async () => {
    vi.mocked(getPushStatus).mockResolvedValue('on');
    render(<PushPromptBanner userId="u1" />);
    await vi.waitFor(() => expect(getPushStatus).toHaveBeenCalled());
    expect(screen.queryByText(/¿Te avisamos/)).not.toBeInTheDocument();
  });
});

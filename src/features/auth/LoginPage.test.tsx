import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import { AppError } from '../../lib/errors';
import { makeAuth, renderRoutes } from '../../test/utils';
import { signIn } from './api';

vi.mock('./api', () => ({ signIn: vi.fn(), signOut: vi.fn(), changePassword: vi.fn() }));
const signInMock = vi.mocked(signIn);

const loggedOut = () => makeAuth({ profile: null });

describe('LoginPage', () => {
  beforeEach(() => {
    signInMock.mockReset();
  });

  it('valida los campos antes de llamar al servidor', async () => {
    renderRoutes(routes, '/login', loggedOut());
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Introduce un email válido')).toBeInTheDocument();
    expect(screen.getByText('Introduce tu contraseña')).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('envía las credenciales', async () => {
    signInMock.mockResolvedValue();
    renderRoutes(routes, '/login', loggedOut());
    await userEvent.type(await screen.findByLabelText('Email'), 'ana@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(signInMock).toHaveBeenCalledWith('ana@empresa.com', 'secreta123');
  });

  it('muestra el error del servidor', async () => {
    signInMock.mockImplementation(async () => {
      throw new AppError('Email o contraseña incorrectos.');
    });
    renderRoutes(routes, '/login', loggedOut());
    await userEvent.type(await screen.findByLabelText('Email'), 'ana@empresa.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  });
});

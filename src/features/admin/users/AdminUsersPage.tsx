import {
  KeyRound,
  Pencil,
  Search,
  Shield,
  ShieldOff,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import ErrorState from '../../../components/ui/ErrorState';
import Modal from '../../../components/ui/Modal';
import Spinner from '../../../components/ui/Spinner';
import { getErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../auth/useAuth';
import type { Profile } from '../../profile/api';
import AvatarUploader from '../../profile/AvatarUploader';
import { useAvatarUrls, useProfiles } from '../../profile/hooks';
import ProfileForm from '../../profile/ProfileForm';
import type { CreateUserResult } from './api';
import CreateUsersModal from './CreateUsersModal';
import CredentialsModal, { type Credential } from './CredentialsModal';
import { useResetPassword, useSetActive, useSetRole } from './hooks';

type CredentialsState = { credentials: Credential[]; failures: CreateUserResult[] } | null;

export default function AdminUsersPage() {
  const { profile: me } = useAuth();
  const { data: profiles, isPending, isError, error, refetch } = useProfiles();
  const { data: avatarUrls } = useAvatarUrls(profiles?.map((p) => p.avatar_path) ?? []);
  const resetPassword = useResetPassword();
  const setRole = useSetRole();
  const setActive = useSetActive();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [credentials, setCredentials] = useState<CredentialsState>(null);
  const [actionError, setActionError] = useState('');

  if (isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-10">
        <ErrorState
          message={`No se pudieron cargar los usuarios. ${getErrorMessage(error)}`}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const normalized = query.trim().toLowerCase();
  const visible = profiles.filter(
    (p) =>
      !normalized ||
      p.full_name.toLowerCase().includes(normalized) ||
      p.email.includes(normalized) ||
      (p.department ?? '').toLowerCase().includes(normalized),
  );
  const pendingPassword = profiles.filter((p) => p.must_change_password && p.is_active).length;

  const onError = (err: unknown) => setActionError(getErrorMessage(err));

  const handleCreated = (results: CreateUserResult[]) => {
    setCreating(false);
    setCredentials({
      credentials: results
        .filter((r) => r.ok && r.temp_password)
        .map((r) => ({
          full_name: r.full_name ?? r.email,
          email: r.email,
          temp_password: r.temp_password!,
        })),
      failures: results.filter((r) => !r.ok),
    });
  };

  const handleReset = (p: Profile) => {
    if (!window.confirm(`¿Generar una nueva contraseña temporal para ${p.full_name}?`)) return;
    setActionError('');
    resetPassword.mutate(p.id, {
      onSuccess: (temp_password) =>
        setCredentials({
          credentials: [{ full_name: p.full_name, email: p.email, temp_password }],
          failures: [],
        }),
      onError,
    });
  };

  const handleRole = (p: Profile) => {
    const makeAdmin = p.role !== 'admin';
    const message = makeAdmin
      ? `¿Dar permisos de administrador a ${p.full_name}?`
      : `¿Quitar permisos de administrador a ${p.full_name}?`;
    if (!window.confirm(message)) return;
    setActionError('');
    setRole.mutate({ userId: p.id, role: makeAdmin ? 'admin' : 'participant' }, { onError });
  };

  const handleActive = (p: Profile) => {
    const message = p.is_active
      ? `¿Desactivar la cuenta de ${p.full_name}? No podrá iniciar sesión.`
      : `¿Reactivar la cuenta de ${p.full_name}?`;
    if (!window.confirm(message)) return;
    setActionError('');
    setActive.mutate({ userId: p.id, active: !p.is_active }, { onError });
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-gray-600">
            {profiles.length} cuentas · {pendingPassword} con contraseña temporal
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus aria-hidden="true" className="w-5 h-5" />
          Agregar usuarios
        </Button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search
          aria-hidden="true"
          className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Buscar usuarios"
          placeholder="Buscar por nombre, email o departamento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none bg-white"
        />
      </div>

      {actionError && (
        <p role="alert" className="text-red-600 mb-4">
          {actionError}
        </p>
      )}

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((p) => {
          const isMe = p.id === me?.id;
          return (
            <li
              key={p.id}
              className={`bg-white rounded-xl shadow p-4 flex gap-4 ${p.is_active ? '' : 'opacity-60'}`}
            >
              <Avatar name={p.full_name} url={p.avatar_path ? avatarUrls?.[p.avatar_path] : null} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-gray-800 truncate">{p.full_name}</h2>
                  {p.role === 'admin' && <Badge tone="primary">Admin</Badge>}
                  {!p.is_active && <Badge tone="gray">Inactivo</Badge>}
                  {p.is_active && p.must_change_password && (
                    <Badge tone="amber">Contraseña temporal</Badge>
                  )}
                  {isMe && <Badge tone="gray">Tú</Badge>}
                </div>
                <p className="text-sm text-gray-500 truncate">{p.email}</p>
                {p.department && <p className="text-sm text-gray-500">{p.department}</p>}

                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm">
                  <ActionButton icon={Pencil} onClick={() => setEditing(p)}>
                    Editar
                  </ActionButton>
                  <ActionButton icon={KeyRound} onClick={() => handleReset(p)}>
                    Restablecer contraseña
                  </ActionButton>
                  {!isMe && (
                    <>
                      <ActionButton
                        icon={p.role === 'admin' ? ShieldOff : Shield}
                        onClick={() => handleRole(p)}
                      >
                        {p.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                      </ActionButton>
                      <ActionButton
                        icon={p.is_active ? UserX : UserCheck}
                        onClick={() => handleActive(p)}
                      >
                        {p.is_active ? 'Desactivar' : 'Reactivar'}
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="text-gray-600 text-center py-8">Ningún usuario coincide con la búsqueda.</p>
      )}

      {creating && (
        <CreateUsersModal onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
      {credentials && (
        <CredentialsModal
          credentials={credentials.credentials}
          failures={credentials.failures}
          onClose={() => setCredentials(null)}
        />
      )}
      {editing && (
        <Modal title={`Editar a ${editing.full_name}`} onClose={() => setEditing(null)}>
          <div className="space-y-6">
            <AvatarUploader
              profile={profiles.find((p) => p.id === editing.id) ?? editing}
              size="md"
            />
            <ProfileForm profile={editing} onSaved={() => setEditing(null)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

const badgeTones = {
  primary: 'bg-primary/10 text-primary-dark',
  amber: 'bg-amber-100 text-amber-800',
  gray: 'bg-gray-100 text-gray-600',
} as const;

function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Pencil;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-dark"
    >
      <Icon aria-hidden="true" className="w-4 h-4" />
      {children}
    </button>
  );
}

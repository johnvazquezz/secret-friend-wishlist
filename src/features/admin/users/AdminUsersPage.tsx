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
import { useConfirm } from '../../../components/ui/useConfirm';
import Badge from '../../../components/ui/Badge';
import PageHeader from '../../../components/ui/PageHeader';
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
  const [confirm, confirmDialog] = useConfirm();

  if (isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
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

  const handleReset = async (p: Profile) => {
    const ok = await confirm({
      title: `¿Restablecer la contraseña de ${p.full_name}?`,
      message: 'Se generará una contraseña temporal nueva y la actual dejará de funcionar.',
      confirmLabel: 'Generar contraseña',
    });
    if (!ok) return;
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

  const handleRole = async (p: Profile) => {
    const makeAdmin = p.role !== 'admin';
    const ok = await confirm(
      makeAdmin
        ? {
            title: `¿Hacer administrador a ${p.full_name}?`,
            message: 'Podrá gestionar el evento y las cuentas del equipo.',
            confirmLabel: 'Hacer admin',
          }
        : {
            title: `¿Quitar los permisos de administrador a ${p.full_name}?`,
            confirmLabel: 'Quitar admin',
            tone: 'danger',
          },
    );
    if (!ok) return;
    setActionError('');
    setRole.mutate({ userId: p.id, role: makeAdmin ? 'admin' : 'participant' }, { onError });
  };

  const handleActive = async (p: Profile) => {
    const ok = await confirm(
      p.is_active
        ? {
            title: `¿Desactivar la cuenta de ${p.full_name}?`,
            message: 'No podrá iniciar sesión hasta que la reactives.',
            confirmLabel: 'Desactivar',
            tone: 'danger',
          }
        : { title: `¿Reactivar la cuenta de ${p.full_name}?`, confirmLabel: 'Reactivar' },
    );
    if (!ok) return;
    setActionError('');
    setActive.mutate({ userId: p.id, active: !p.is_active }, { onError });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description={`${profiles.length} cuentas · ${pendingPassword} con contraseña temporal`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus aria-hidden="true" className="w-4 h-4" />
            Agregar usuarios
          </Button>
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search
          aria-hidden="true"
          className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Buscar usuarios"
          placeholder="Buscar por nombre, email o departamento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-base h-11 py-0 pl-10"
        />
      </div>

      {actionError && (
        <p role="alert" className="alert-error mb-4">
          {actionError}
        </p>
      )}

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visible.map((p) => {
          const isMe = p.id === me?.id;
          return (
            <li
              key={p.id}
              className={`card p-4 sm:p-5 flex gap-4 ${p.is_active ? '' : 'bg-stone-50 opacity-70'}`}
            >
              <Avatar name={p.full_name} url={p.avatar_path ? avatarUrls?.[p.avatar_path] : null} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-sans text-base font-semibold text-stone-900 truncate">
                    {p.full_name}
                  </h2>
                  {p.role === 'admin' && <Badge tone="primary">Admin</Badge>}
                  {!p.is_active && <Badge tone="neutral">Inactivo</Badge>}
                  {p.is_active && p.must_change_password && (
                    <Badge tone="warning">Contraseña temporal</Badge>
                  )}
                  {isMe && <Badge tone="neutral">Tú</Badge>}
                </div>
                <p className="text-sm text-stone-500 truncate">{p.email}</p>
                {p.department && <p className="text-sm text-stone-500">{p.department}</p>}

                <div className="flex flex-wrap gap-1 mt-3 -ml-2 pt-3 border-t border-stone-100">
                  <ActionButton icon={Pencil} onClick={() => setEditing(p)}>
                    Editar
                  </ActionButton>
                  <ActionButton icon={KeyRound} onClick={() => void handleReset(p)}>
                    Restablecer contraseña
                  </ActionButton>
                  {!isMe && (
                    <>
                      <ActionButton
                        icon={p.role === 'admin' ? ShieldOff : Shield}
                        onClick={() => void handleRole(p)}
                      >
                        {p.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                      </ActionButton>
                      <ActionButton
                        icon={p.is_active ? UserX : UserCheck}
                        onClick={() => void handleActive(p)}
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
        <p className="text-stone-600 text-center py-8">Ningún usuario coincide con la búsqueda.</p>
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
      {confirmDialog}
    </div>
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
      className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
    >
      <Icon aria-hidden="true" className="w-4 h-4" />
      {children}
    </button>
  );
}

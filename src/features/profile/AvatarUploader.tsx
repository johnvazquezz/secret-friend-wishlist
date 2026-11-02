import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import Avatar from '../../components/ui/Avatar';
import { getErrorMessage } from '../../lib/errors';
import { validateImageFile } from '../../lib/image';
import type { Profile } from './api';
import { useAvatarUrls, useRemoveAvatar, useUploadAvatar } from './hooks';

interface AvatarUploaderProps {
  profile: Profile;
  size?: 'md' | 'lg';
}

/** Foto de perfil con botones para cambiarla o quitarla. Sirve para el propio usuario y para el admin. */
export default function AvatarUploader({ profile, size = 'lg' }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const { data: urls } = useAvatarUrls([profile.avatar_path]);
  const upload = useUploadAvatar(profile.id);
  const remove = useRemoveAvatar(profile.id);
  const busy = upload.isPending || remove.isPending;

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validation = validateImageFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    upload.mutate(file, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={profile.full_name}
        url={profile.avatar_path ? urls?.[profile.avatar_path] : null}
        size={size}
      />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark disabled:opacity-50"
          >
            <Camera aria-hidden="true" className="w-4 h-4" />
            {upload.isPending ? 'Subiendo...' : profile.avatar_path ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {profile.avatar_path && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                remove.mutate(undefined, { onError: (err) => setError(getErrorMessage(err)) })
              }
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" />
              Quitar
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
          aria-label={`Foto de ${profile.full_name}`}
        />
      </div>
    </div>
  );
}

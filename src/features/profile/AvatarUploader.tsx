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
    <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
      <Avatar
        name={profile.full_name}
        url={profile.avatar_path ? urls?.[profile.avatar_path] : null}
        size={size}
        className="ring-4 ring-stone-100"
      />
      <div className="space-y-3">
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold bg-white text-stone-800 border border-stone-300 shadow-sm hover:bg-stone-50 transition-colors disabled:opacity-50"
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
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" />
              Quitar
            </button>
          )}
        </div>
        <p className="text-xs text-stone-500">Una imagen de hasta 10 MB. Se mostrará redonda.</p>
        {error && <p className="alert-error">{error}</p>}
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

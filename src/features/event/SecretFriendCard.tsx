import { Eye, EyeOff, Gift } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../components/ui/Avatar';
import { useAvatarUrls } from '../profile/hooks';
import type { MyAssignment } from './api';

/** Muestra a quién le regala el usuario. Oculto por defecto para evitar miradas indiscretas. */
export default function SecretFriendCard({ assignment }: { assignment: MyAssignment }) {
  const [visible, setVisible] = useState(false);
  const { data: urls } = useAvatarUrls(visible ? [assignment.avatar_path] : []);

  return (
    <section className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4 flex items-center gap-3">
        <Gift aria-hidden="true" className="w-7 h-7 text-white" />
        <h2 className="text-2xl font-bold text-white">Tu amigo secreto</h2>
      </div>
      <div className="p-6 text-center">
        {visible ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-gray-600">Este año le regalas a…</p>
            <Avatar
              name={assignment.full_name}
              url={assignment.avatar_path ? urls?.[assignment.avatar_path] : null}
              size="lg"
            />
            <p className="text-3xl font-bold text-gray-800">{assignment.full_name}</p>
            {assignment.department && <p className="text-gray-500">{assignment.department}</p>}
          </div>
        ) : (
          <p className="text-gray-600 py-6">
            Asegúrate de que nadie esté mirando tu pantalla antes de mostrarlo.
          </p>
        )}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="mt-6 inline-flex items-center gap-2 font-medium text-primary hover:text-primary-dark"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="w-5 h-5" />
          ) : (
            <Eye aria-hidden="true" className="w-5 h-5" />
          )}
          {visible ? 'Ocultar' : 'Mostrar a quién le regalo'}
        </button>
        <p className="mt-4 text-sm text-gray-500">
          🤫 Es un secreto: nadie más puede verlo, ni siquiera los organizadores. No se lo cuentes a
          nadie.
        </p>
      </div>
    </section>
  );
}

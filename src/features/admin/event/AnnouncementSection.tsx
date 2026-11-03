import { Megaphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Button from '../../../components/ui/Button';
import TextAreaField from '../../../components/ui/TextAreaField';
import TextField from '../../../components/ui/TextField';
import { getErrorMessage } from '../../../lib/errors';
import { useSendAnnouncement } from '../../notifications/hooks';

/** Aviso del organizador a todos los usuarios activos (aparece en su campana). */
export default function AnnouncementSection() {
  const send = useSendAnnouncement();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<number | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSentTo(null);
    if (!title.trim()) {
      setError('Escribe un título para el aviso.');
      return;
    }
    if (!window.confirm('El aviso llegará a todas las personas con cuenta activa. ¿Enviar?'))
      return;
    setError('');
    send.mutate(
      { title: title.trim(), body: body.trim() },
      {
        onSuccess: (count) => {
          setSentTo(count);
          setTitle('');
          setBody('');
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  return (
    <section className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">Enviar un aviso</h2>
      <p className="text-sm text-gray-500 mb-4">
        Aparece en la campana de notificaciones de todos. Útil para cambios de sala, horario o
        recordatorios.
      </p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label="Título"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextAreaField
          label="Mensaje (opcional)"
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        {sentTo !== null && <p className="text-green-700">Aviso enviado a {sentTo} personas.</p>}
        <Button type="submit" disabled={send.isPending}>
          <Megaphone aria-hidden="true" className="w-5 h-5" />
          {send.isPending ? 'Enviando...' : 'Enviar aviso'}
        </Button>
      </form>
    </section>
  );
}

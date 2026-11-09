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
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-stone-900 mb-1">Enviar un aviso</h2>
      <p className="text-sm text-stone-500 mb-4">
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
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}
        {sentTo !== null && <p className="alert-success">Aviso enviado a {sentTo} personas.</p>}
        <Button type="submit" disabled={send.isPending}>
          <Megaphone aria-hidden="true" className="w-5 h-5" />
          {send.isPending ? 'Enviando...' : 'Enviar aviso'}
        </Button>
      </form>
    </section>
  );
}

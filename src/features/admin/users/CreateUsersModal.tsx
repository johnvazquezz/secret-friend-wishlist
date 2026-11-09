import { UserPlus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { getErrorMessage } from '../../../lib/errors';
import type { CreateUserResult } from './api';
import { parseBulkUsers } from './bulkParse';
import { useCreateUsers } from './hooks';

interface CreateUsersModalProps {
  onClose: () => void;
  onCreated: (results: CreateUserResult[]) => void;
}

export default function CreateUsersModal({ onClose, onCreated }: CreateUsersModalProps) {
  const textareaId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const create = useCreateUsers();

  const parsed = useMemo(() => parseBulkUsers(text), [text]);
  const valid = parsed.flatMap((line) => (line.user ? [line.user] : []));
  const invalid = parsed.filter((line) => line.error);

  const submit = () => {
    setError('');
    create.mutate(valid, {
      onSuccess: onCreated,
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  return (
    <Modal title="Agregar usuarios" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor={textareaId} className="block text-stone-700 font-semibold mb-2">
            Una persona por línea
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Ana Pérez; ana@empresa.com; Finanzas\nLuis Gómez; luis@empresa.com'}
            className="input-base h-40 font-mono text-sm"
          />
          <p className="text-sm text-stone-500 mt-1">
            Formato: <code>Nombre; email; Departamento (opcional)</code>. También puedes pegar
            columnas copiadas de Excel.
          </p>
        </div>

        {parsed.length > 0 && (
          <p className="text-sm text-stone-700">
            {valid.length} listos para crear
            {invalid.length > 0 && (
              <span className="alert-error"> · {invalid.length} con errores</span>
            )}
          </p>
        )}
        {invalid.length > 0 && (
          <ul className="text-sm text-red-700 bg-red-50 rounded-lg p-3 space-y-1">
            {invalid.map((line) => (
              <li key={line.line}>
                Línea {line.line}: {line.error}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={submit} disabled={valid.length === 0 || create.isPending}>
            <UserPlus aria-hidden="true" className="w-5 h-5" />
            {create.isPending ? 'Creando...' : `Crear ${valid.length || ''} usuario(s)`}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

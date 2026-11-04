import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';

export interface Credential {
  full_name: string;
  email: string;
  temp_password: string;
}

interface CredentialsModalProps {
  credentials: Credential[];
  failures?: { email: string; error?: string }[];
  onClose: () => void;
}

/** Muestra UNA sola vez las contraseñas temporales para que el admin las entregue. */
export default function CredentialsModal({
  credentials,
  failures = [],
  onClose,
}: CredentialsModalProps) {
  const [copied, setCopied] = useState(false);

  const text = credentials
    .map((c) => `${c.full_name} — ${c.email} — Contraseña temporal: ${c.temp_password}`)
    .join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <Modal title="Contraseñas temporales" onClose={onClose}>
      <div className="space-y-4">
        {credentials.length > 0 && (
          <>
            <p className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
              Copia estas contraseñas ahora: <strong>no se volverán a mostrar</strong>. Entrégalas
              en persona o por mensaje privado. Cada persona deberá cambiarla al entrar.
            </p>
            <ul className="divide-y divide-gray-100 border rounded-lg">
              {credentials.map((c) => (
                <li key={c.email} className="p-3 flex flex-wrap justify-between gap-2">
                  <span>
                    <span className="font-medium text-gray-800">{c.full_name}</span>{' '}
                    <span className="text-gray-500 text-sm">{c.email}</span>
                  </span>
                  <code className="font-mono bg-gray-100 px-2 py-1 rounded select-all">
                    {c.temp_password}
                  </code>
                </li>
              ))}
            </ul>
          </>
        )}
        {failures.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-sm text-red-800">
            <p className="font-medium mb-1">No se pudieron crear:</p>
            <ul className="list-disc ml-5">
              {failures.map((f) => (
                <li key={f.email}>
                  {f.email}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {credentials.length > 0 && (
            <Button onClick={() => void copy()}>
              {copied ? (
                <Check aria-hidden="true" className="w-5 h-5" />
              ) : (
                <Copy aria-hidden="true" className="w-5 h-5" />
              )}
              {copied ? 'Copiado' : 'Copiar todo'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

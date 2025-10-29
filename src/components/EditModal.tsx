import { useState } from 'react';
import { X, Lock, Save } from 'lucide-react';
import { TeamMember, supabase } from '../lib/supabase';

interface EditModalProps {
  member: TeamMember;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditModal({ member, onClose, onUpdate }: EditModalProps) {
  const [accessCode, setAccessCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [wishes, setWishes] = useState(member.wishes);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = () => {
    if (accessCode === member.access_code) {
      setIsVerified(true);
      setError('');
    } else {
      setError('Código de acceso incorrecto');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('team_members')
        .update({
          wishes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', member.id)
        .eq('access_code', accessCode);

      if (updateError) throw updateError;

      onUpdate();
      onClose();
    } catch (err) {
      setError('Error al guardar los cambios');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="bg-gradient-to-r from-primary to-primary-dark p-6 flex justify-between items-center sticky top-0">
          <h2 className="text-2xl font-bold text-white">Editar Tarjeta de {member.name}</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {!isVerified ? (
            <div className="space-y-4">
              <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-6 text-center">
                <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="text-gray-700 mb-4">
                  Ingresa tu código de acceso para editar tu tarjeta
                </p>
                <input
                  type="password"
                  placeholder="Código de acceso"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none mb-4"
                />
                {error && <p className="text-red-600 mb-4">{error}</p>}
                <button
                  onClick={handleVerify}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Verificar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Mis deseos para el Amigo Secreto
                </label>
                <textarea
                  value={wishes}
                  onChange={(e) => setWishes(e.target.value)}
                  placeholder="Escribe qué te gustaría recibir..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none h-32 resize-none"
                />
              </div>





              {error && <p className="text-red-600">{error}</p>}

              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

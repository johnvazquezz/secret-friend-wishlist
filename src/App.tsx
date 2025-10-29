import { useState, useEffect } from 'react';
import { Gift, Users, Plus, Sparkles, HandHeart } from 'lucide-react';
import { supabase, TeamMember } from './lib/supabase';
import MemberCard from './components/MemberCard';
import EditModal from './components/EditModal';

function App() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCode, setNewMemberCode] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberCode.trim()) {
      setAddError('Por favor completa todos los campos');
      return;
    }

    try {
      const { error } = await supabase.from('team_members').insert({
        name: newMemberName.trim(),
        access_code: newMemberCode.trim(),
        wishes: ''
      });

      if (error) {
        if (error.code === '23505') {
          setAddError('Este código de acceso ya está en uso');
        } else {
          throw error;
        }
        return;
      }

      setNewMemberName('');
      setNewMemberCode('');
      setShowAddMember(false);
      setAddError('');
      fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      setAddError('Error al agregar miembro');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-white to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-white to-primary/10">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Sparkles className="w-12 h-12 text-primary animate-pulse" />
            <Gift className="w-16 h-16 text-primary" />
            <Sparkles className="w-12 h-12 text-primary animate-pulse" />
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Amigo Secreto
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Comparte tus deseos con el equipo
          </p>
          <div className="flex items-center justify-center gap-2 text-primary">
            <Users className="w-5 h-5" />
            <span className="font-semibold">{members.length} miembros del equipo</span>
          </div>
        </div>

        {members.length === 0 && !showAddMember && (
          <div className="text-center mb-8">
            <p className="text-gray-600 mb-4">No hay miembros aún. ¡Agrega el primero!</p>
          </div>
        )}

        <div className="mb-8 flex justify-center">
          {!showAddMember ? (
            <button
              onClick={() => setShowAddMember(true)}
              className="bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-lg transition-colors items-center gap-2 shadow-lg hover:shadow-xl hidden"
            >
              <Plus className="w-5 h-5" />
              Agregar Miembro
            </button>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Nuevo Miembro</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Nombre</label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Código de acceso (secreto)
                  </label>
                  <input
                    type="password"
                    value={newMemberCode}
                    onChange={(e) => setNewMemberCode(e.target.value)}
                    placeholder="Crea un código único"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Este código será necesario para editar la tarjeta
                  </p>
                </div>
                {addError && <p className="text-red-600">{addError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddMember}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMember(false);
                      setNewMemberName('');
                      setNewMemberCode('');
                      setAddError('');
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={setSelectedMember}
            />
          ))}
        </div>

        {selectedMember && (
          <EditModal
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
            onUpdate={fetchMembers}
          />
        )}
      </div>

      <footer className="text-center py-8 text-gray-600">
        <p className="flex items-center justify-center gap-2">
          Hecho con <HandHeart className="w-6 h-6 text-primary" /> para el Amigo Secreto
        </p>
      </footer>
    </div>
  );
}

export default App;

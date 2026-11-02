import { Gift, Sparkles, Users } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { useMembers } from './hooks';
import MemberCard from './MemberCard';

export default function MembersPage() {
  const { data: members, isPending, isError, error, refetch } = useMembers();

  if (isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-4" aria-hidden="true">
          <Sparkles className="w-12 h-12 text-primary animate-pulse" />
          <Gift className="w-16 h-16 text-primary" />
          <Sparkles className="w-12 h-12 text-primary animate-pulse" />
        </div>
        <h1 className="text-5xl font-bold text-gray-800 mb-4">Amigo Secreto</h1>
        <p className="text-xl text-gray-600 mb-6">Comparte tus deseos con el equipo</p>
        {!isError && (
          <div className="flex items-center justify-center gap-2 text-primary">
            <Users aria-hidden="true" className="w-5 h-5" />
            <span className="font-semibold">{members.length} miembros del equipo</span>
          </div>
        )}
      </header>

      {isError ? (
        <ErrorState
          message={`No se pudieron cargar los miembros. ${getErrorMessage(error)}`}
          onRetry={() => void refetch()}
        />
      ) : members.length === 0 ? (
        <EmptyState message="No hay miembros aún." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

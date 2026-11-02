import { Gift, UserCircle } from 'lucide-react';
import type { Member } from './api';

interface MemberCardProps {
  member: Member;
}

export default function MemberCard({ member }: MemberCardProps) {
  return (
    <article className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full">
      <div className="bg-gradient-to-r from-primary to-primary-dark px-5 py-2">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
            <UserCircle aria-hidden="true" className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white">{member.name}</h3>
        </div>
      </div>

      <div className="p-6 flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Gift aria-hidden="true" className="w-6 h-6 text-primary" />
            <h4 className="font-semibold text-gray-700">Deseos para el Amigo Secreto</h4>
          </div>
          <p className="text-gray-600 ml-7 whitespace-pre-wrap">
            {member.wishes || 'Sin deseos especificados aún'}
          </p>
        </div>
      </div>
    </article>
  );
}

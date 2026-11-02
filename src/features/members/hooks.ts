import { useQuery } from '@tanstack/react-query';
import { fetchMembers } from './api';

export const membersKeys = {
  all: ['members'] as const,
};

export function useMembers() {
  return useQuery({ queryKey: membersKeys.all, queryFn: fetchMembers });
}

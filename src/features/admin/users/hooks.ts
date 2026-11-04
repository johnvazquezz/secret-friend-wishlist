import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileKeys } from '../../profile/hooks';
import { createUsers, resetPassword, setActive, setRole } from './api';
import type { NewUser } from './bulkParse';

function useInvalidateProfiles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: profileKeys.all });
}

export function useCreateUsers() {
  const onSuccess = useInvalidateProfiles();
  return useMutation({ mutationFn: (users: NewUser[]) => createUsers(users), onSuccess });
}

export function useResetPassword() {
  const onSuccess = useInvalidateProfiles();
  return useMutation({ mutationFn: (userId: string) => resetPassword(userId), onSuccess });
}

export function useSetRole() {
  const onSuccess = useInvalidateProfiles();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'participant' | 'admin' }) =>
      setRole(userId, role),
    onSuccess,
  });
}

export function useSetActive() {
  const onSuccess = useInvalidateProfiles();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      setActive(userId, active),
    onSuccess,
  });
}

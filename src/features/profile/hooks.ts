import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prepareAvatar } from '../../lib/image';
import {
  fetchAvatarUrls,
  fetchProfile,
  fetchProfiles,
  removeAvatar,
  updateProfile,
  uploadAvatar,
  type ProfileUpdate,
} from './api';

export const profileKeys = {
  all: ['profiles'] as const,
  list: () => [...profileKeys.all, 'list'] as const,
  detail: (id: string) => [...profileKeys.all, 'detail', id] as const,
  avatarUrls: (paths: string[]) => ['avatar-urls', ...paths] as const,
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? ''),
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}

export function useProfiles() {
  return useQuery({ queryKey: profileKeys.list(), queryFn: fetchProfiles });
}

/** Mapa ruta → URL firmada. Las URLs duran 1 h; se refrescan antes de caducar. */
export function useAvatarUrls(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))].sort();
  return useQuery({
    queryKey: profileKeys.avatarUrls(unique),
    queryFn: () => fetchAvatarUrls(unique),
    enabled: unique.length > 0,
    staleTime: 50 * 60 * 1000,
  });
}

function useInvalidateProfiles() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['avatar-urls'] }),
    ]);
}

export function useUpdateProfile(userId: string) {
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => updateProfile(userId, update),
    onSuccess: invalidate,
  });
}

export function useUploadAvatar(userId: string) {
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: async (file: File) => uploadAvatar(userId, await prepareAvatar(file)),
    onSuccess: invalidate,
  });
}

export function useRemoveAvatar(userId: string) {
  const invalidate = useInvalidateProfiles();
  return useMutation({ mutationFn: () => removeAvatar(userId), onSuccess: invalidate });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWishlistItem,
  deleteWishlistItem,
  fetchAllWishlists,
  fetchMyPreferences,
  fetchRecipientPreferences,
  fetchWishlist,
  reorderWishlist,
  savePreferences,
  updateWishlistItem,
  type Preferences,
  type WishlistItemInput,
} from './api';

export const wishlistKeys = {
  all: ['wishlist'] as const,
  byUser: (userId: string) => [...wishlistKeys.all, 'user', userId] as const,
  everyone: () => [...wishlistKeys.all, 'everyone'] as const,
  myPreferences: () => ['preferences', 'mine'] as const,
  recipientPreferences: (eventId: string) => ['preferences', 'recipient', eventId] as const,
};

export function useWishlist(userId: string | undefined) {
  return useQuery({
    queryKey: wishlistKeys.byUser(userId ?? ''),
    queryFn: () => fetchWishlist(userId!),
    enabled: !!userId,
  });
}

export function useAllWishlists() {
  return useQuery({ queryKey: wishlistKeys.everyone(), queryFn: fetchAllWishlists });
}

function useInvalidateWishlists() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
}

export function useCreateWishlistItem() {
  const onSuccess = useInvalidateWishlists();
  return useMutation({
    mutationFn: ({ input, position }: { input: WishlistItemInput; position: number }) =>
      createWishlistItem(input, position),
    onSuccess,
  });
}

export function useUpdateWishlistItem() {
  const onSuccess = useInvalidateWishlists();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WishlistItemInput }) =>
      updateWishlistItem(id, input),
    onSuccess,
  });
}

export function useDeleteWishlistItem() {
  const onSuccess = useInvalidateWishlists();
  return useMutation({ mutationFn: (id: string) => deleteWishlistItem(id), onSuccess });
}

export function useReorderWishlist() {
  const onSettled = useInvalidateWishlists();
  return useMutation({ mutationFn: (ids: string[]) => reorderWishlist(ids), onSettled });
}

export function useMyPreferences() {
  return useQuery({ queryKey: wishlistKeys.myPreferences(), queryFn: fetchMyPreferences });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Preferences) => savePreferences(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wishlistKeys.myPreferences() }),
  });
}

export function useRecipientPreferences(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: wishlistKeys.recipientPreferences(eventId),
    queryFn: () => fetchRecipientPreferences(eventId),
    enabled,
  });
}

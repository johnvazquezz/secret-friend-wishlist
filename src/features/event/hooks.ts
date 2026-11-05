import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addExclusion,
  addParticipants,
  claimRecipient,
  createEvent,
  fetchCanChangeMyClaim,
  releaseMyClaim,
  releaseRecipient,
  deleteEvent,
  fetchActiveEvent,
  fetchDrawSummary,
  fetchEventStats,
  fetchExclusions,
  fetchMyAssignment,
  fetchMyParticipation,
  fetchParticipants,
  removeExclusion,
  removeParticipant,
  respondParticipation,
  runLifecycleAction,
  setParticipation,
  updateEvent,
  type EventInput,
  type EventStatus,
  type Exclusion,
  type LifecycleAction,
  type ParticipationStatus,
} from './api';

export const eventKeys = {
  all: ['event'] as const,
  active: () => [...eventKeys.all, 'active'] as const,
  myParticipation: (eventId: string, userId: string) =>
    [...eventKeys.all, eventId, 'my-participation', userId] as const,
  myAssignment: (eventId: string) => [...eventKeys.all, eventId, 'my-assignment'] as const,
  canChangeClaim: (eventId: string) => [...eventKeys.all, eventId, 'can-change-claim'] as const,
  participants: (eventId: string) => [...eventKeys.all, eventId, 'participants'] as const,
  exclusions: (eventId: string) => [...eventKeys.all, eventId, 'exclusions'] as const,
  summary: (eventId: string) => [...eventKeys.all, eventId, 'summary'] as const,
  stats: (eventId: string) => [...eventKeys.all, eventId, 'stats'] as const,
};

function useInvalidateEvent() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: eventKeys.all });
}

// ---------------------------------------------------------------------------
// Participante
// ---------------------------------------------------------------------------
export function useActiveEvent() {
  return useQuery({
    queryKey: eventKeys.active(),
    queryFn: fetchActiveEvent,
    // El estado del evento lo cambia el admin desde otro equipo: refrescar al volver a la pestaña.
    refetchOnWindowFocus: true,
  });
}

export function useMyParticipation(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: eventKeys.myParticipation(eventId ?? '', userId ?? ''),
    queryFn: () => fetchMyParticipation(eventId!, userId!),
    enabled: !!eventId && !!userId,
  });
}

export function useRespondParticipation(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: (accept: boolean) => respondParticipation(eventId, accept),
    onSuccess,
  });
}

const VISIBLE_ASSIGNMENT_STATUSES: EventStatus[] = ['published', 'finished'];

export function useMyAssignment(eventId: string | undefined, status: EventStatus | undefined) {
  return useQuery({
    queryKey: eventKeys.myAssignment(eventId ?? ''),
    queryFn: () => fetchMyAssignment(eventId!),
    enabled: !!eventId && !!status && VISIBLE_ASSIGNMENT_STATUSES.includes(status),
  });
}

/** Al registrar o cambiar destinatario también cambian las conversaciones disponibles. */
function useInvalidateEventAndChat() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: eventKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['chat'] }),
    ]);
}

export function useClaimRecipient(eventId: string) {
  const onSuccess = useInvalidateEventAndChat();
  return useMutation({
    mutationFn: (receiverId: string) => claimRecipient(eventId, receiverId),
    onSuccess,
  });
}

export function useReleaseMyClaim(eventId: string) {
  const onSuccess = useInvalidateEventAndChat();
  return useMutation({ mutationFn: () => releaseMyClaim(eventId), onSuccess });
}

export function useCanChangeMyClaim(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: eventKeys.canChangeClaim(eventId),
    queryFn: () => fetchCanChangeMyClaim(eventId),
    enabled,
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export function useReleaseRecipient(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: (receiverId: string) => releaseRecipient(eventId, receiverId),
    onSuccess,
  });
}

export function useCreateEvent() {
  const onSuccess = useInvalidateEvent();
  return useMutation({ mutationFn: (input: EventInput) => createEvent(input), onSuccess });
}

export function useUpdateEvent(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({ mutationFn: (input: EventInput) => updateEvent(eventId, input), onSuccess });
}

export function useDeleteEvent(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({ mutationFn: () => deleteEvent(eventId), onSuccess });
}

export function useLifecycleAction(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: (action: LifecycleAction) => runLifecycleAction(action, eventId),
    onSuccess,
  });
}

export function useEventStats(eventId: string) {
  return useQuery({
    queryKey: eventKeys.stats(eventId),
    queryFn: () => fetchEventStats(eventId),
    refetchInterval: 60_000,
  });
}

export function useDrawSummary(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: eventKeys.summary(eventId),
    queryFn: () => fetchDrawSummary(eventId),
    enabled,
  });
}

export function useParticipants(eventId: string) {
  return useQuery({
    queryKey: eventKeys.participants(eventId),
    queryFn: () => fetchParticipants(eventId),
  });
}

export function useAddParticipants(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: (userIds: string[]) => addParticipants(eventId, userIds),
    onSuccess,
  });
}

export function useRemoveParticipant(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: (userId: string) => removeParticipant(eventId, userId),
    onSuccess,
  });
}

export function useSetParticipation(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: ParticipationStatus }) =>
      setParticipation(eventId, userId, status),
    onSuccess,
  });
}

export function useExclusions(eventId: string) {
  return useQuery({
    queryKey: eventKeys.exclusions(eventId),
    queryFn: () => fetchExclusions(eventId),
  });
}

export function useAddExclusion(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: ({ a, b }: { a: string; b: string }) => addExclusion(eventId, a, b),
    onSuccess,
  });
}

export function useRemoveExclusion(eventId: string) {
  const onSuccess = useInvalidateEvent();
  return useMutation({
    mutationFn: (pair: Exclusion) => removeExclusion(eventId, pair),
    onSuccess,
  });
}

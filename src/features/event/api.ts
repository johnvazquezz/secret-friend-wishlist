import type { Database, Tables } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type EventRow = Tables<'events'>;
export type EventStatus = Database['public']['Enums']['event_status'];
export type ParticipationStatus = Database['public']['Enums']['participation_status'];

export interface EventInput {
  name: string;
  description: string | null;
  rules: string | null;
  budget_amount: number | null;
  currency: string;
  location: string | null;
  registration_deadline: string | null;
  exchange_at: string | null;
}

export interface MyAssignment {
  receiver_id: string;
  full_name: string;
  department: string | null;
  avatar_path: string | null;
}

export interface Participant {
  user_id: string;
  status: ParticipationStatus;
  responded_at: string | null;
  profile: Pick<
    Tables<'profiles'>,
    'full_name' | 'email' | 'department' | 'avatar_path' | 'is_active'
  > | null;
}

export interface Exclusion {
  user_a: string;
  user_b: string;
}

export interface DrawSummary {
  confirmed: number;
  assigned: number;
  is_valid: boolean;
}

// ---------------------------------------------------------------------------
// Participante
// ---------------------------------------------------------------------------

/** El evento en curso (no finalizado). Los participantes no ven borradores (RLS). */
export async function fetchActiveEvent(): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .neq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyParticipation(
  eventId: string,
  userId: string,
): Promise<ParticipationStatus | null> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

export async function respondParticipation(eventId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_participation', {
    p_event_id: eventId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function fetchMyAssignment(eventId: string): Promise<MyAssignment | null> {
  const { data, error } = await supabase.rpc('get_my_assignment', { p_event_id: eventId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function createEvent(input: EventInput): Promise<EventRow> {
  const { data, error } = await supabase.from('events').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateEvent(eventId: string, input: EventInput): Promise<void> {
  const { error } = await supabase.from('events').update(input).eq('id', eventId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

export type LifecycleAction =
  'open_event' | 'run_draw' | 'reset_draw' | 'publish_draw' | 'finish_event';

export async function runLifecycleAction(action: LifecycleAction, eventId: string): Promise<void> {
  const { error } = await supabase.rpc(action, { p_event_id: eventId });
  if (error) throw error;
}

export async function fetchDrawSummary(eventId: string): Promise<DrawSummary | null> {
  const { data, error } = await supabase.rpc('draw_summary', { p_event_id: eventId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchParticipants(eventId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('event_participants')
    .select(
      'user_id, status, responded_at, profile:profiles(full_name, email, department, avatar_path, is_active)',
    )
    .eq('event_id', eventId);
  if (error) throw error;
  return (data ?? []).sort((a, b) =>
    (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '', 'es'),
  );
}

export async function addParticipants(eventId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase
    .from('event_participants')
    .insert(userIds.map((user_id) => ({ event_id: eventId, user_id })));
  if (error) throw error;
}

export async function removeParticipant(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setParticipation(
  eventId: string,
  userId: string,
  status: ParticipationStatus,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_participation', {
    p_event_id: eventId,
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
}

export async function fetchExclusions(eventId: string): Promise<Exclusion[]> {
  const { data, error } = await supabase
    .from('exclusions')
    .select('user_a, user_b')
    .eq('event_id', eventId);
  if (error) throw error;
  return data ?? [];
}

/** Las exclusiones son mutuas y se guardan ordenadas (user_a < user_b). */
export function orderPair(a: string, b: string): Exclusion {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export async function addExclusion(eventId: string, a: string, b: string): Promise<void> {
  const { error } = await supabase
    .from('exclusions')
    .insert({ event_id: eventId, ...orderPair(a, b) });
  if (error) throw error;
}

export async function removeExclusion(eventId: string, pair: Exclusion): Promise<void> {
  const { error } = await supabase
    .from('exclusions')
    .delete()
    .eq('event_id', eventId)
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b);
  if (error) throw error;
}

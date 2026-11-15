import { parsePlan, type PlanStep } from '@/core/live/live'
import { invalidate } from '@/lib/query'
import { requireSupabase, type Tables } from './supabase'

/**
 * Séances en direct : état en base (Supabase, diffusé par Realtime) et jetons de visio
 * (fonction `livekit-token`). Toutes les actions passent par des fonctions SQL qui
 * vérifient les droits (prof de la classe, élève de la classe).
 */

export type LiveSessionRow = Tables<'live_sessions'>
export type Activity = 'idle' | 'listening' | 'reciting'

export interface LiveRoom {
  id: string
  kind: 'main' | 'breakout'
  name: string
  position: number
  capacity: number
  teacher_visited_at: string | null
}

export interface LiveParticipant {
  user_id: string
  room_id: string | null
  display_name: string
  is_teacher: boolean
  activity: Activity
  hand_raised_at: string | null
  current_verse: string | null
  last_seen_at: string
}

export interface LiveState {
  session: LiveSessionRow & { class_name: string; teacher_id: string }
  plan: PlanStep[]
  rooms: LiveRoom[]
  participants: LiveParticipant[]
  members: { user_id: string; display_name: string }[]
  announcements: { id: string; body: string; created_at: string }[]
}

/** Les fonctions renvoient { error: 'code' } : on remonte ce code (traduit par errorMessage). */
async function functionError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    const body = (await ctx.json().catch(() => null)) as { error?: string } | null
    if (body?.error) return new Error(body.error)
  }
  return error instanceof Error ? error : new Error(String(error))
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

// ---------------------------------------------------------------- préparation (prof)

export async function listSessions(classId: string): Promise<LiveSessionRow[]> {
  return (
    check(await requireSupabase().from('live_sessions').select('*').eq('class_id', classId).order('created_at', { ascending: false }).limit(20)) ?? []
  )
}

export async function getSession(id: string): Promise<LiveSessionRow | null> {
  return check(await requireSupabase().from('live_sessions').select('*').eq('id', id).maybeSingle())
}

/** Séances en cours dans mes classes (bandeau « Rejoindre » de l'accueil). */
export async function liveNow(): Promise<(LiveSessionRow & { classes: { name: string } | null })[]> {
  const data = check(await requireSupabase().from('live_sessions').select('*, classes(name)').eq('status', 'live'))
  return (data ?? []) as unknown as (LiveSessionRow & { classes: { name: string } | null })[]
}

export async function createSession(classId: string, userId: string, title: string, plan: readonly PlanStep[]) {
  const data = check(
    await requireSupabase()
      .from('live_sessions')
      .insert({ class_id: classId, created_by: userId, title: title.trim(), plan: plan as unknown as never })
      .select('id')
      .single(),
  )
  invalidate('sessions')
  return data!.id
}

export async function updateSession(
  id: string,
  patch: { title?: string; plan?: PlanStep[]; tajweed_focus?: string | null; passage?: { surah: number; from: number; to: number } | null; notes?: string | null },
) {
  check(await requireSupabase().from('live_sessions').update(patch as never).eq('id', id))
  invalidate('sessions')
}

export async function deleteSession(id: string) {
  check(await requireSupabase().from('live_sessions').delete().eq('id', id))
  invalidate('sessions')
}

// ---------------------------------------------------------------- pendant la séance

const rpc = async (fn: string, args: Record<string, unknown>) => {
  // les noms de fonctions sont typés dans database.types ; on passe par une signature souple ici
  const res = await (requireSupabase().rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    fn,
    args,
  )
  if (res.error) throw res.error
  return res.data
}

export async function fetchState(sessionId: string): Promise<LiveState> {
  const raw = (await rpc('session_state', { session_id: sessionId })) as Omit<LiveState, 'plan'>
  return { ...raw, plan: parsePlan(raw.session.plan) }
}

export const startSession = (id: string) => rpc('start_session', { session_id: id }).then(() => invalidate('sessions'))
export const endSession = (id: string) => rpc('end_session', { session_id: id }).then(() => invalidate('sessions'))
export const joinSession = (id: string) => rpc('join_session', { session_id: id }) as Promise<string>
export const setStep = (id: string, step: number) => rpc('set_step', { session_id: id, step })
export const recallAll = (id: string) => rpc('recall_all', { session_id: id })
export const closeRoom = (id: string, roomId: string) => rpc('close_room', { session_id: id, room_id: roomId })
export const moveParticipant = (id: string, userId: string, roomId: string) =>
  rpc('move_participant', { session_id: id, user_id: userId, room_id: roomId })
export const chooseRoom = (id: string, roomId: string) => rpc('choose_room', { session_id: id, room_id: roomId })
export const openRooms = (id: string, count: number, groups: string[][] | null, mode: 'assigned' | 'free', capacity: number) =>
  rpc('open_rooms', { session_id: id, room_count: count, groups, mode, capacity })

/** Talqîn : la base enregistre qui a la parole, puis le serveur LiveKit coupe les autres micros. */
export async function setFloor(id: string, userId: string | null) {
  await rpc('set_floor', { session_id: id, user_id: userId })
  const { error } = await requireSupabase().functions.invoke('livekit-moderation', { body: { session_id: id } })
  if (error) throw await functionError(error)
}

export async function setFocusVerse(id: string, verse: string | null) {
  check(await requireSupabase().from('live_sessions').update({ focus_verse: verse }).eq('id', id))
}

export async function announce(sessionId: string, authorId: string, body: string) {
  check(await requireSupabase().from('live_announcements').insert({ session_id: sessionId, author_id: authorId, body: body.trim() }))
}

/** Indicateurs de l'élève (main levée, verset en cours, signe de vie). */
export async function updateMe(
  sessionId: string,
  userId: string,
  patch: { hand_raised_at?: string | null; current_verse?: string | null; activity?: Activity; last_seen_at?: string },
) {
  check(await requireSupabase().from('live_participants').update(patch).eq('session_id', sessionId).eq('user_id', userId))
}

export async function liveToken(sessionId: string): Promise<{ token: string; url: string; room_id: string; room_name: string }> {
  const { data, error } = await requireSupabase().functions.invoke('livekit-token', { body: { session_id: sessionId } })
  if (error) throw await functionError(error)
  return data as { token: string; url: string; room_id: string; room_name: string }
}

/** Abonnement aux changements de la séance ; `onChange` est appelé (regroupé) à chaque modification. */
export function subscribeSession(sessionId: string, onChange: () => void) {
  const db = requireSupabase()
  let timer: ReturnType<typeof setTimeout> | null = null
  const bump = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(onChange, 120)
  }
  const channel = db
    .channel(`live:${sessionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms', filter: `session_id=eq.${sessionId}` }, bump)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_participants', filter: `session_id=eq.${sessionId}` }, bump)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_announcements', filter: `session_id=eq.${sessionId}` }, bump)
    .subscribe()
  return () => {
    if (timer) clearTimeout(timer)
    void db.removeChannel(channel)
  }
}

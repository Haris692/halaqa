import type { StrokeAnchor } from '@/core/annotations/anchors'
import type { Stroke, StrokeStyle, WordMark } from '@/core/annotations/strokes'
import { decodePoints, encodePoints } from '@/core/annotations/strokes'
import type { Correction, ErrorType } from '@/core/live/tools'
import type { VerseKey, WordId } from '@/core/quran/types'
import { requireSupabase } from './supabase'

/**
 * Outils du prof (phase 4) : traits et marquages enregistrés, corrections, validations,
 * prise de main, crayon de l'élève, test « continue le verset », agrégat et récapitulatif.
 * Les droits sont vérifiés par la base (RLS et fonctions SQL).
 */

const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
  const res = await (requireSupabase().rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    fn,
    args,
  )
  if (res.error) throw res.error
  return res.data
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

// ---------------------------------------------------------------- tableau de la salle

interface AnnotationRow {
  id: string
  author_id: string
  author_role: 'teacher' | 'peer'
  kind: 'stroke' | 'mark'
  anchor: StrokeAnchor | null
  points: number[] | null
  words: WordId[] | null
  style: Record<string, unknown>
}

export interface Board {
  strokes: Stroke[]
  marks: WordMark[]
  corrections: Correction[]
  /** prof de la séance (ses traits sont pleins, ceux des élèves en pointillé) */
  teacherId?: string | null
}

function toBoard(rows: AnnotationRow[], corrections: Correction[]): Board {
  const strokes: Stroke[] = []
  const marks: WordMark[] = []
  for (const r of rows) {
    if (r.kind === 'stroke' && r.anchor && r.points) {
      strokes.push({ id: r.id, author: r.author_id, anchor: r.anchor, style: r.style as unknown as StrokeStyle, points: decodePoints(r.points), done: true })
    } else if (r.kind === 'mark' && r.words) {
      const style = r.style as { kind?: WordMark['kind']; color?: WordMark['color'] }
      marks.push({ id: r.id, author: r.author_id, words: r.words, kind: style.kind ?? 'highlight', color: style.color ?? 'yellow' })
    }
  }
  return { strokes, marks, corrections }
}

export async function roomBoard(roomId: string): Promise<Board> {
  const raw = (await rpc('room_board', { room_id: roomId })) as { annotations: AnnotationRow[]; corrections: Correction[] }
  return toBoard(raw.annotations, raw.corrections)
}

/** Après la séance : ce que l'élève a reçu (ou, pour le prof, ce qu'a reçu un élève). */
export async function reviewBoard(sessionId: string, studentId: string): Promise<Board> {
  const db = requireSupabase()
  const [annotations, corrections, session] = await Promise.all([
    db.from('annotations').select('id, author_id, author_role, kind, anchor, points, words, style').eq('session_id', sessionId).contains('student_ids', [studentId]),
    db.from('corrections').select('*').eq('session_id', sessionId).eq('student_id', studentId).eq('status', 'confirmed'),
    db.from('live_sessions').select('classes(teacher_id)').eq('id', sessionId).maybeSingle(),
  ])
  const board = toBoard(check(annotations) as unknown as AnnotationRow[], (check(corrections) ?? []) as unknown as Correction[])
  const cls = (check(session) as unknown as { classes: { teacher_id: string } | null } | null)?.classes
  return { ...board, teacherId: cls?.teacher_id ?? null }
}

export async function saveStroke(roomId: string, s: Stroke) {
  check(
    await requireSupabase()
      .from('annotations')
      .insert({ id: s.id, room_id: roomId, kind: 'stroke', anchor: s.anchor as never, points: encodePoints(s.points), style: s.style as never } as never),
  )
}

export async function saveMark(roomId: string, m: WordMark) {
  check(
    await requireSupabase()
      .from('annotations')
      .insert({ id: m.id, room_id: roomId, kind: 'mark', words: m.words, style: { kind: m.kind, color: m.color } } as never),
  )
}

export async function deleteAnnotations(ids: readonly string[]) {
  if (ids.length) check(await requireSupabase().from('annotations').delete().in('id', [...ids]))
}

export const clearBoard = (roomId: string) => rpc('clear_board', { room_id: roomId })

// ---------------------------------------------------------------- corrections et validations

export async function saveCorrection(c: Pick<Correction, 'id' | 'room_id' | 'student_id' | 'word' | 'error_type' | 'tajweed_rule' | 'comment'>): Promise<Correction> {
  const row = check(
    await requireSupabase()
      .from('corrections')
      .insert({ id: c.id, room_id: c.room_id, student_id: c.student_id, word: c.word, error_type: c.error_type, tajweed_rule: c.tajweed_rule, comment: c.comment } as never)
      .select('*')
      .single(),
  )
  return row as unknown as Correction
}

export async function updateCorrection(
  id: string,
  patch: { status?: 'confirmed'; error_type?: ErrorType; tajweed_rule?: string | null; comment?: string | null },
): Promise<Correction> {
  const row = check(await requireSupabase().from('corrections').update(patch as never).eq('id', id).select('*').single())
  return row as unknown as Correction
}

export async function deleteCorrection(id: string) {
  check(await requireSupabase().from('corrections').delete().eq('id', id))
}

export async function addVerseResult(sessionId: string, studentId: string, verse: VerseKey, result: 'validated' | 'review') {
  check(await requireSupabase().from('verse_results').insert({ session_id: sessionId, student_id: studentId, verse, result } as never))
}

// ---------------------------------------------------------------- état de la salle (prof)

export const setRoomPen = (roomId: string, allowed: boolean) => rpc('set_room_pen', { room_id: roomId, allowed })
export const setRoomLeader = (roomId: string, take: boolean) => rpc('set_room_leader', { room_id: roomId, take })
export const startQuiz = (roomId: string, studentId: string) => rpc('start_quiz', { room_id: roomId, student_id: studentId }) as Promise<string>
export const revealQuiz = (roomId: string) => rpc('reveal_quiz', { room_id: roomId })
export const endQuiz = (roomId: string) => rpc('end_quiz', { room_id: roomId })

export async function setShowSummary(sessionId: string, show: boolean) {
  check(await requireSupabase().from('live_sessions').update({ show_summary: show } as never).eq('id', sessionId))
}

// ---------------------------------------------------------------- retour commun et récapitulatif

export interface ErrorSummary {
  total: number
  by_type: { error_type: ErrorType; tajweed_rule: string | null; count: number }[]
  by_word: { word: WordId; count: number; students: number }[]
}

export const errorSummary = (sessionId: string) => rpc('session_error_summary', { session_id: sessionId }) as Promise<ErrorSummary>

export interface RecapCorrection {
  id: string
  word: WordId
  verse: VerseKey
  error_type: ErrorType
  tajweed_rule: string | null
  comment: string | null
  author_role: 'teacher' | 'peer'
  status: 'confirmed' | 'pending'
}

export interface Recap {
  session: {
    id: string
    title: string
    status: 'planned' | 'live' | 'ended'
    started_at: string | null
    ended_at: string | null
    passage: { surah: number; from: number; to: number } | null
    tajweed_focus: string | null
    class_name: string
    class_id: string
    teacher_name: string | null
  }
  students: {
    student_id: string
    display_name: string
    corrections: RecapCorrection[]
    results: { verse: VerseKey; result: 'validated' | 'review' }[]
    verses: VerseKey[]
    annotations: number
  }[]
}

export const sessionRecap = (sessionId: string) => rpc('session_recap', { session_id: sessionId }) as Promise<Recap>

export interface PastSession {
  id: string
  title: string
  started_at: string | null
  ended_at: string | null
  class_name: string
  corrections: number
}

export const mySessions = () => rpc('my_sessions') as Promise<PastSession[]>

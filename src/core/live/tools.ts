import type { AnnotationMessage, AnnotationState } from '../annotations/protocol'
import type { WordMark } from '../annotations/strokes'
import { parseWordId, verseKey, type VerseKey, type WordId } from '../quran/types'

/**
 * Logique pure des outils du prof dans une salle (phase 4) : messages en direct et
 * règles de réception, corrections, vue partagée, test « continue le verset ».
 */

// ---------------------------------------------------------------- corrections

/** Types d'erreur du menu rapide (section 5.6). */
export const ERROR_TYPES = ['pronunciation', 'tajweed', 'haraka', 'forgotten', 'added', 'memory'] as const
export type ErrorType = (typeof ERROR_TYPES)[number]

/** Règles de tajwid proposées quand l'erreur est de type « tajwid ». */
export const TAJWEED_ERROR_RULES = ['madd', 'ghunna', 'qalqala', 'idgham', 'ikhfa', 'iqlab', 'other'] as const
export type TajweedErrorRule = (typeof TAJWEED_ERROR_RULES)[number]

export interface Correction {
  id: string
  room_id: string | null
  student_id: string
  author_id: string | null
  author_role: 'teacher' | 'peer'
  /** les marquages du binôme attendent la confirmation du prof */
  status: 'confirmed' | 'pending'
  word: WordId
  error_type: ErrorType
  tajweed_rule: string | null
  comment: string | null
}

export function upsertCorrection(list: readonly Correction[], c: Correction): Correction[] {
  const i = list.findIndex((x) => x.id === c.id)
  if (i < 0) return [...list, c]
  const next = [...list]
  next[i] = c
  return next
}

export const removeCorrection = (list: readonly Correction[], id: string): Correction[] => list.filter((c) => c.id !== id)

/** Corrections affichées sur le texte : celles de l'élève suivi (le prof ou le binôme choisit qui). */
export function visibleCorrections(list: readonly Correction[], student: string | null): Correction[] {
  return student ? list.filter((c) => c.student_id === student) : []
}

/**
 * Classe CSS de chaque mot : marquages (surligner / souligner) puis corrections par-dessus
 * (le mot fautif passe en rouge ; un marquage du binôme non confirmé reste distinct).
 */
export function wordClasses(
  marks: readonly WordMark[],
  corrections: readonly Correction[],
  teacherId: string | null,
  pendingStart: WordId | null = null,
): Map<WordId, string> {
  const map = new Map<WordId, string>()
  const add = (w: WordId, cls: string) => map.set(w, map.has(w) ? `${map.get(w)} ${cls}` : cls)
  for (const m of marks) {
    const cls = `mark-${m.kind}-${m.color}${m.author !== teacherId ? ' mark-student' : ''}`
    for (const w of m.words) add(w, cls)
  }
  for (const c of corrections) add(c.word, c.status === 'confirmed' ? 'corr-error' : 'corr-pending')
  if (pendingStart) add(pendingStart, 'mark-pending')
  return map
}

// ---------------------------------------------------------------- vue partagée

export type ViewMode = 'reading' | 'mushaf'

/** Où se trouve quelqu'un dans le lecteur (envoyé dans la salle à chaque changement). */
export interface ViewState {
  mode: ViewMode
  /** premier verset visible (mode lecture) ou verset sélectionné / premier de la page (Mushaf) */
  verse: VerseKey
  page: number
  /** verset en cours de lecture audio, ou null */
  playing: VerseKey | null
  /** horodatage d'envoi : on ignore un état plus ancien que celui qu'on a déjà */
  at: number
}

export function sameView(a: ViewState | null | undefined, b: ViewState | null | undefined): boolean {
  if (!a || !b) return a === b
  return a.mode === b.mode && a.verse === b.verse && a.page === b.page && a.playing === b.playing
}

/**
 * Qui suivre : le prof qui a « pris la main » (pour les élèves), sinon, pour le prof,
 * l'élève dont il a choisi la vue. Personne ne se suit soi-même.
 */
export function followTarget(opts: {
  me: string
  isTeacher: boolean
  leaderId: string | null
  chosen: string | null
}): string | null {
  if (opts.leaderId && opts.leaderId !== opts.me) return opts.leaderId
  if (opts.isTeacher && !opts.leaderId && opts.chosen && opts.chosen !== opts.me) return opts.chosen
  return null
}

/** Premier verset visible sous l'en-tête (mode lecture). */
export function topVisibleVerse(verses: readonly { key: string; top: number; bottom: number }[], offset: number): string | null {
  for (const v of verses) if (v.bottom > offset + 4) return v.key
  return verses.at(-1)?.key ?? null
}

// ---------------------------------------------------------------- messages en direct

/** Messages échangés dans une salle par les canaux data LiveKit. */
export type LiveMessage =
  | Exclude<AnnotationMessage, { t: 'sync-request' } | { t: 'sync-state' }>
  | { t: 'view'; view: ViewState }
  | { t: 'view-request' }
  | { t: 'corr'; c: Correction }
  | { t: 'corr-del'; id: string }
  /** le prof confirme un marquage du binôme */
  | { t: 'corr-ok'; id: string }

export interface RoomRules {
  teacherId: string
  /** le prof a autorisé le crayon aux élèves de la salle */
  studentPen: boolean
}

/**
 * Un message reçu de `from` est-il recevable ? Un navigateur modifié peut envoyer
 * n'importe quoi dans la salle : on n'applique que ce que son auteur a le droit de faire
 * (la base applique les mêmes règles pour ce qui est enregistré).
 */
export function acceptMessage(
  msg: LiveMessage,
  from: string,
  rules: RoomRules,
  board: { annotations: AnnotationState; corrections: readonly Correction[] },
): boolean {
  const teacher = from === rules.teacherId
  const authorOf = (id: string) => board.annotations.strokes.find((s) => s.id === id)?.author
  switch (msg.t) {
    case 'view':
    case 'view-request':
      return true
    case 'stroke-start':
      return msg.author === from && (teacher || rules.studentPen)
    case 'mark':
      return msg.mark.author === from && (teacher || rules.studentPen)
    case 'stroke-points':
    case 'stroke-end':
      return authorOf(msg.id) === from
    case 'unmark':
      return teacher || board.annotations.marks.find((m) => m.id === msg.id)?.author === from
    case 'erase':
      return teacher || msg.ids.every((id) => authorOf(id) === from)
    case 'clear':
      return teacher
    case 'corr':
      if (msg.c.author_id !== from) return false
      if (teacher) return msg.c.author_role === 'teacher'
      // un élève : uniquement un marquage en attente, sur un autre que lui
      return (
        msg.c.author_role === 'peer' &&
        msg.c.status === 'pending' &&
        msg.c.student_id !== from &&
        !board.corrections.some((c) => c.id === msg.c.id && c.author_id !== from)
      )
    case 'corr-ok':
      return teacher
    case 'corr-del': {
      if (teacher) return true
      const c = board.corrections.find((x) => x.id === msg.id)
      return !!c && c.author_id === from && c.status === 'pending'
    }
  }
}

// ---------------------------------------------------------------- test « continue le verset »

export interface Quiz {
  student_id: string
  verse: VerseKey
  revealed: boolean
  started_at: string
}

export function parseQuiz(raw: unknown): Quiz | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  if (typeof q.student_id !== 'string' || typeof q.verse !== 'string' || !/^\d{1,3}:\d{1,3}$/.test(q.verse)) return null
  return { student_id: q.student_id, verse: q.verse as VerseKey, revealed: q.revealed === true, started_at: String(q.started_at ?? '') }
}

/** Nombre de mots montrés au départ : assez pour reconnaître le verset, pas plus (1 à 3). */
export function quizLeadWords(wordCount: number): number {
  if (wordCount <= 3) return 1
  return Math.min(3, Math.max(1, Math.floor(wordCount / 4)))
}

// ---------------------------------------------------------------- récapitulatif

/** Regroupe des versets consécutifs d'une même sourate : 112:1, 112:2, 112:3 → « 112:1-3 ». */
export function verseRanges(verses: readonly string[]): string[] {
  const parsed = [...new Set(verses)]
    .map((v) => v.split(':').map(Number) as [number, number])
    .filter(([s, a]) => s > 0 && a > 0)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1])
  const out: string[] = []
  let i = 0
  while (i < parsed.length) {
    const [s, from] = parsed[i]!
    let to = from
    while (i + 1 < parsed.length && parsed[i + 1]![0] === s && parsed[i + 1]![1] === to + 1) {
      i++
      to = parsed[i]![1]
    }
    out.push(from === to ? `${s}:${from}` : `${s}:${from}-${to}`)
    i++
  }
  return out
}

export const verseOfWord = (id: WordId): VerseKey => {
  const w = parseWordId(id)
  return verseKey(w.surah, w.verse)
}

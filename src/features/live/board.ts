import { create } from 'zustand'
import { applyMessage, emptyAnnotations, pruneLasers, type AnnotationMessage, type AnnotationState } from '@/core/annotations/protocol'
import type { StrokeColor, WordMark } from '@/core/annotations/strokes'
import {
  acceptMessage,
  removeCorrection,
  upsertCorrection,
  type Correction,
  type ErrorType,
  type LiveMessage,
  type ViewState,
} from '@/core/live/tools'
import type { WordId } from '@/core/quran/types'
import { useAuth } from '@/features/auth/store'
import { errorMessage } from '@/features/auth/errors'
import i18n from '@/i18n'
import {
  clearBoard,
  deleteAnnotations,
  deleteCorrection,
  reviewBoard,
  roomBoard,
  saveCorrection,
  saveMark,
  saveStroke,
  updateCorrection,
} from '@/services/tools'
import { publish } from './bus'
import { useLive } from './store'

/**
 * Tableau de la salle où l'on se trouve : traits, marquages, corrections et vue de chacun.
 * Chargé depuis la base à l'entrée dans la salle, puis tenu à jour par les messages LiveKit.
 * Ne dépend pas de LiveKit : le lecteur l'importe directement.
 */

export type BoardTool = 'none' | 'pen' | 'laser' | 'eraser' | 'mark' | 'correct'
export const STROKE_WIDTHS = { fine: 0.05, medium: 0.09, thick: 0.15 } as const
export type StrokeWidth = keyof typeof STROKE_WIDTHS

interface BoardStore {
  roomId: string | null
  annotations: AnnotationState
  corrections: Correction[]
  /** dernière vue reçue de chaque participant de la salle */
  views: Record<string, ViewState>
  error: string | null
  // outils (propres à chacun)
  tool: BoardTool
  color: StrokeColor
  width: StrokeWidth
  markKind: WordMark['kind']
  rangeMode: boolean
  /** élève dont on affiche (et relève) les erreurs */
  focusStudent: string | null
  /** prof : élève dont il suit la vue (null = vue libre) */
  followChoice: string | null
  /** menu de correction ouvert sur un mot (position à l'écran) */
  menu: { word: WordId; x: number; y: number } | null
  /** révision après la séance (lecture seule) */
  review: { sessionId: string; title: string; studentId: string; teacherId: string | null } | null

  enter: (roomId: string) => Promise<void>
  reset: () => void
  receive: (msg: LiveMessage, from: string) => void
  set: (
    patch: Partial<Pick<BoardStore, 'tool' | 'color' | 'width' | 'markKind' | 'rangeMode' | 'focusStudent' | 'followChoice' | 'error' | 'menu'>>,
  ) => void
  loadReview: (sessionId: string, studentId: string, title: string) => Promise<void>
  exitReview: () => void
  /** applique localement et envoie dans la salle */
  emit: (msg: Exclude<AnnotationMessage, { t: 'sync-request' } | { t: 'sync-state' }>) => void
  pruneLasers: (now: number) => void
  finishStroke: (id: string) => void
  erase: (ids: string[]) => void
  clearAll: () => Promise<void>
  addMark: (mark: WordMark) => void
  removeMark: (id: string) => void
  addCorrection: (c: { student_id: string; word: WordId; error_type: ErrorType; tajweed_rule: string | null; comment: string | null }) => Promise<void>
  confirmCorrection: (id: string) => Promise<void>
  removeCorrection: (id: string) => Promise<void>
}

const me = () => useAuth.getState().profile?.id ?? ''
const rules = () => {
  const { state } = useLive.getState()
  const room = state?.rooms.find((r) => r.id === useBoard.getState().roomId)
  return { teacherId: state?.session.teacher_id ?? '', studentPen: room?.student_pen ?? false }
}
const fail = (e: unknown) => useBoard.setState({ error: errorMessage(i18n.t.bind(i18n), e) })
let loadToken = 0

export const useBoard = create<BoardStore>()((set, get) => ({
  roomId: null,
  annotations: emptyAnnotations(),
  corrections: [],
  views: {},
  error: null,
  tool: 'none',
  color: 'red',
  width: 'medium',
  markKind: 'highlight',
  rangeMode: false,
  focusStudent: null,
  followChoice: null,
  menu: null,
  review: null,

  enter: async (roomId) => {
    const token = ++loadToken
    set({ roomId, review: null, menu: null, annotations: emptyAnnotations(), corrections: [], views: {}, error: null, followChoice: null, focusStudent: null })
    try {
      const board = await roomBoard(roomId)
      if (token !== loadToken) return
      // les messages arrivés pendant le chargement sont gardés (traits en cours)
      set((s) => ({
        annotations: {
          strokes: [...board.strokes, ...s.annotations.strokes.filter((x) => !board.strokes.some((b) => b.id === x.id))],
          marks: [...board.marks, ...s.annotations.marks.filter((x) => !board.marks.some((b) => b.id === x.id))],
        },
        corrections: s.corrections.reduce(upsertCorrection, board.corrections),
      }))
    } catch (e) {
      if (token === loadToken) fail(e)
    }
  },

  reset: () => {
    loadToken++
    set({ roomId: null, menu: null, annotations: emptyAnnotations(), corrections: [], views: {}, error: null, tool: 'none', followChoice: null, focusStudent: null })
  },

  loadReview: async (sessionId, studentId, title) => {
    if (get().roomId) return // pendant une séance, le tableau de la salle a la priorité
    const token = ++loadToken
    set({ review: { sessionId, studentId, title, teacherId: null }, tool: 'none', menu: null, focusStudent: studentId, error: null })
    try {
      const board = await reviewBoard(sessionId, studentId)
      if (token !== loadToken) return
      set((s) => ({
        annotations: { strokes: board.strokes, marks: board.marks },
        corrections: board.corrections,
        review: s.review ? { ...s.review, teacherId: board.teacherId ?? null } : null,
      }))
    } catch (e) {
      if (token === loadToken) fail(e)
    }
  },

  exitReview: () => {
    if (!get().review) return
    loadToken++
    set({ review: null, menu: null, annotations: emptyAnnotations(), corrections: [], focusStudent: null })
  },

  receive: (msg, from) => {
    const s = get()
    if (!s.roomId || from === me()) return
    if (!acceptMessage(msg, from, rules(), s)) return
    switch (msg.t) {
      case 'view': {
        const prev = s.views[from]
        if (prev && prev.at > msg.view.at) return
        set({ views: { ...s.views, [from]: msg.view } })
        return
      }
      case 'view-request':
        return
      case 'corr':
        set({ corrections: upsertCorrection(s.corrections, msg.c) })
        return
      case 'corr-del':
        set({ corrections: removeCorrection(s.corrections, msg.id) })
        return
      case 'corr-ok':
        set({ corrections: s.corrections.map((c) => (c.id === msg.id ? { ...c, status: 'confirmed' as const } : c)) })
        return
      default:
        set({ annotations: applyMessage(s.annotations, msg, me()) })
    }
  },

  set: (patch) => set(patch),

  emit: (msg) => {
    set((s) => ({ annotations: applyMessage(s.annotations, msg, me()) }))
    publish(msg)
  },

  pruneLasers: (now) => {
    const next = pruneLasers(get().annotations, now)
    if (next !== get().annotations) set({ annotations: next })
  },

  finishStroke: (id) => {
    const { roomId, annotations } = get()
    const stroke = annotations.strokes.find((s) => s.id === id)
    if (!roomId || !stroke || stroke.style.tool === 'laser' || stroke.points.length === 0) return
    saveStroke(roomId, stroke).catch(fail)
  },

  erase: (ids) => {
    if (!ids.length) return
    get().emit({ t: 'erase', ids })
    deleteAnnotations(ids).catch(fail)
  },

  clearAll: async () => {
    const { roomId } = get()
    if (!roomId) return
    get().emit({ t: 'clear' })
    await clearBoard(roomId).catch(fail)
  },

  addMark: (mark) => {
    const { roomId } = get()
    if (!roomId) return
    get().emit({ t: 'mark', mark })
    saveMark(roomId, mark).catch((e: unknown) => {
      fail(e)
      get().emit({ t: 'unmark', id: mark.id })
    })
  },

  removeMark: (id) => {
    get().emit({ t: 'unmark', id })
    deleteAnnotations([id]).catch(fail)
  },

  addCorrection: async (input) => {
    const { roomId } = get()
    if (!roomId) return
    const teacher = rules().teacherId === me()
    const draft: Correction = {
      id: crypto.randomUUID(),
      room_id: roomId,
      author_id: me(),
      author_role: teacher ? 'teacher' : 'peer',
      status: teacher ? 'confirmed' : 'pending',
      ...input,
      comment: input.comment?.trim() || null,
    }
    set((s) => ({ corrections: upsertCorrection(s.corrections, draft), error: null }))
    try {
      const saved = await saveCorrection(draft)
      set((s) => ({ corrections: upsertCorrection(s.corrections, saved) }))
      publish({ t: 'corr', c: saved })
    } catch (e) {
      set((s) => ({ corrections: removeCorrection(s.corrections, draft.id) }))
      fail(e)
    }
  },

  confirmCorrection: async (id) => {
    try {
      const saved = await updateCorrection(id, { status: 'confirmed' })
      set((s) => ({ corrections: upsertCorrection(s.corrections, saved) }))
      publish({ t: 'corr-ok', id })
    } catch (e) {
      fail(e)
    }
  },

  removeCorrection: async (id) => {
    const before = get().corrections
    set({ corrections: removeCorrection(before, id) })
    try {
      await deleteCorrection(id)
      publish({ t: 'corr-del', id })
    } catch (e) {
      set({ corrections: before })
      fail(e)
    }
  },
}))

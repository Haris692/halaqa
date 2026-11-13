import type { StrokeAnchor } from './anchors'
import { decodePoints, isLaserExpired, type Stroke, type StrokeStyle, type WordMark } from './strokes'

/**
 * Messages échangés pour les annotations en direct. En phase 0 ils passent par
 * BroadcastChannel (deux onglets) ; en phase 4 par les canaux data LiveKit.
 */
export type AnnotationMessage =
  | { t: 'stroke-start'; id: string; author: string; anchor: StrokeAnchor; style: StrokeStyle }
  | { t: 'stroke-points'; id: string; pts: number[] }
  | { t: 'stroke-end'; id: string; endedAt: number }
  | { t: 'erase'; ids: string[] }
  | { t: 'clear' }
  | { t: 'mark'; mark: WordMark }
  | { t: 'unmark'; id: string }
  | { t: 'sync-request'; from: string }
  | { t: 'sync-state'; to: string; strokes: Stroke[]; marks: WordMark[] }

export interface AnnotationState {
  strokes: Stroke[]
  marks: WordMark[]
}

export const emptyAnnotations = (): AnnotationState => ({ strokes: [], marks: [] })

export function applyMessage(state: AnnotationState, msg: AnnotationMessage, selfId: string): AnnotationState {
  switch (msg.t) {
    case 'stroke-start':
      if (state.strokes.some((s) => s.id === msg.id)) return state
      return {
        ...state,
        strokes: [
          ...state.strokes,
          { id: msg.id, author: msg.author, anchor: msg.anchor, style: msg.style, points: [], done: false },
        ],
      }
    case 'stroke-points':
      return {
        ...state,
        strokes: state.strokes.map((s) =>
          s.id === msg.id ? { ...s, points: [...s.points, ...decodePoints(msg.pts)] } : s,
        ),
      }
    case 'stroke-end':
      return {
        ...state,
        strokes: state.strokes.map((s) => (s.id === msg.id ? { ...s, done: true, endedAt: msg.endedAt } : s)),
      }
    case 'erase':
      return { ...state, strokes: state.strokes.filter((s) => !msg.ids.includes(s.id)) }
    case 'clear':
      return emptyAnnotations()
    case 'mark':
      return { ...state, marks: [...state.marks.filter((m) => m.id !== msg.mark.id), msg.mark] }
    case 'unmark':
      return { ...state, marks: state.marks.filter((m) => m.id !== msg.id) }
    case 'sync-state':
      return msg.to === selfId ? { strokes: msg.strokes, marks: msg.marks } : state
    case 'sync-request':
      return state
  }
}

/** Retire les traits laser expirés ; renvoie le même objet s'il n'y a rien à retirer. */
export function pruneLasers(state: AnnotationState, now: number): AnnotationState {
  const kept = state.strokes.filter((s) => !isLaserExpired(s, now))
  return kept.length === state.strokes.length ? state : { ...state, strokes: kept }
}

/** État à persister : les traits terminés, sans les lasers (éphémères). */
export function persistable(state: AnnotationState): AnnotationState {
  return { strokes: state.strokes.filter((s) => s.done && s.style.tool !== 'laser'), marks: state.marks }
}

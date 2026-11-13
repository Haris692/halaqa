import type { VerseKey, WordId } from '../quran/types'

/**
 * On ne stocke JAMAIS de pixels écran : chaque point est exprimé dans le repère
 * d'une ancre, ce qui permet de redessiner correctement quel que soit l'écran,
 * le zoom ou l'orientation.
 *
 *  - `page`  : mode Mushaf. Coordonnées 0–1 relatives à la page (mise en page figée).
 *  - `verse` : mode lecture, approche de la spec. Coordonnées 0–1 relatives au bloc
 *              du verset. Limite : si le texte se reflow (zoom), le trait ne suit
 *              plus les mots.
 *  - `word`  : approche proposée. Coordonnées en « em » (taille de police)
 *              relatives au CENTRE du mot le plus proche du début du trait.
 *              Le trait suit le mot même quand les lignes se recomposent, et
 *              reste à peu près en place entre mode lecture et mode Mushaf
 *              (le centre varie moins que les bords d'une police à l'autre).
 */
export type StrokeAnchor =
  | { kind: 'page'; page: number }
  | { kind: 'verse'; verse: VerseKey }
  | { kind: 'word'; word: WordId }

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface PxPoint {
  x: number
  y: number
}

/** Point dans le repère de l'ancre. */
export type AnchorPoint = readonly [x: number, y: number]

/**
 * Repère concret d'une ancre à l'écran : sa boîte, et l'unité de longueur à
 * utiliser (largeur/hauteur de la boîte pour page/verset, taille de police pour mot).
 */
export interface AnchorFrame {
  box: Rect
  fontPx: number
}

export function toAnchorPoint(kind: StrokeAnchor['kind'], frame: AnchorFrame, p: PxPoint): AnchorPoint {
  const { box, fontPx } = frame
  if (kind === 'word') {
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    return [(p.x - cx) / fontPx, (p.y - cy) / fontPx]
  }
  return [(p.x - box.left) / box.width, (p.y - box.top) / box.height]
}

export function fromAnchorPoint(kind: StrokeAnchor['kind'], frame: AnchorFrame, p: AnchorPoint): PxPoint {
  const { box, fontPx } = frame
  if (kind === 'word') {
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    return { x: cx + p[0] * fontPx, y: cy + p[1] * fontPx }
  }
  return { x: box.left + p[0] * box.width, y: box.top + p[1] * box.height }
}

function distanceToRect(p: PxPoint, r: Rect): number {
  const dx = Math.max(r.left - p.x, 0, p.x - (r.left + r.width))
  const dy = Math.max(r.top - p.y, 0, p.y - (r.top + r.height))
  return Math.hypot(dx, dy)
}

/** Mot le plus proche d'un point (pour ancrer un trait en mode lecture). */
export function nearestWord(p: PxPoint, words: readonly { id: WordId; rect: Rect }[]): WordId | null {
  let best: WordId | null = null
  let bestDist = Infinity
  for (const w of words) {
    const d = distanceToRect(p, w.rect)
    if (d < bestDist) {
      bestDist = d
      best = w.id
    }
  }
  return best
}

/** Mots d'une plage [from, to] (dans n'importe quel ordre), selon l'ordre de lecture. */
export function wordsInRange(order: readonly WordId[], from: WordId, to: WordId): WordId[] {
  const a = order.indexOf(from)
  const b = order.indexOf(to)
  if (a < 0 || b < 0) return []
  return order.slice(Math.min(a, b), Math.max(a, b) + 1)
}

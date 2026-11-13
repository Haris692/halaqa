import { useLayoutEffect, useState, type RefObject } from 'react'
import { fromAnchorPoint, type AnchorFrame, type PxPoint, type Rect, type StrokeAnchor } from '@/core/annotations/anchors'
import type { Stroke } from '@/core/annotations/strokes'
import type { WordId } from '@/core/quran/types'

/** Repère à l'écran (coordonnées client) d'une ancre, ou null si elle n'est pas affichée. */
export function findFrame(surface: HTMLElement, anchor: StrokeAnchor): AnchorFrame | null {
  const selector =
    anchor.kind === 'page'
      ? `[data-page="${anchor.page}"]`
      : anchor.kind === 'verse'
        ? `[data-verse="${anchor.verse}"]`
        : `[data-w="${anchor.word}"]`
  const el = surface.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    box: { left: r.left, top: r.top, width: r.width, height: r.height },
    fontPx: parseFloat(getComputedStyle(el).fontSize),
  }
}

export function wordRects(surface: HTMLElement): { id: WordId; rect: Rect }[] {
  return Array.from(surface.querySelectorAll<HTMLElement>('[data-w]')).map((el) => {
    const r = el.getBoundingClientRect()
    return { id: el.dataset.w as WordId, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }
  })
}

export function verseRects(surface: HTMLElement): { key: string; rect: Rect }[] {
  return Array.from(surface.querySelectorAll<HTMLElement>('[data-verse]')).map((el) => {
    const r = el.getBoundingClientRect()
    return { key: el.dataset.verse!, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }
  })
}

export interface StrokeGeometry {
  /** points en pixels, relatifs à la surface de dessin */
  points: PxPoint[]
  widthPx: number
}

/**
 * Convertit chaque trait (stocké en coordonnées d'ancre) en pixels pour
 * l'affichage courant. Recalculé à chaque changement de traits ou de mise en page.
 */
export function useStrokeGeometry(
  surfaceRef: RefObject<HTMLElement | null>,
  strokes: readonly Stroke[],
  layoutKey: unknown,
): Map<string, StrokeGeometry> {
  const [geometry, setGeometry] = useState<Map<string, StrokeGeometry>>(new Map())
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const origin = surface.getBoundingClientRect()
    const next = new Map<string, StrokeGeometry>()
    for (const s of strokes) {
      const frame = findFrame(surface, s.anchor)
      if (!frame) continue // ancre absente de cette vue (ex. trait de page en mode lecture)
      next.set(s.id, {
        points: s.points.map((p) => {
          const px = fromAnchorPoint(s.anchor.kind, frame, p)
          return { x: px.x - origin.left, y: px.y - origin.top }
        }),
        widthPx: s.style.width * frame.fontPx,
      })
    }
    setGeometry(next)
  }, [surfaceRef, strokes, layoutKey])
  return geometry
}

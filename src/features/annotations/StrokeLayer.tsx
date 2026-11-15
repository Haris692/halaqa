import { getStroke } from 'perfect-freehand'
import { laserOpacity, type Stroke, type StrokeColor } from '@/core/annotations/strokes'
import type { StrokeGeometry } from './geometry'

export const COLOR_HEX: Record<StrokeColor, string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#eab308',
}

/** Contour perfect-freehand → chemin SVG (courbes quadratiques). */
function pathFromOutline(outline: number[][]): string {
  if (outline.length < 2) return ''
  const [first, ...rest] = outline
  let d = `M ${first![0]!.toFixed(1)} ${first![1]!.toFixed(1)} Q`
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!
    const b = rest[(i + 1) % rest.length]!
    d += ` ${a[0]!.toFixed(1)} ${a[1]!.toFixed(1)} ${((a[0]! + b[0]!) / 2).toFixed(1)} ${((a[1]! + b[1]!) / 2).toFixed(1)}`
  }
  return d + ' Z'
}

/**
 * Calque SVG des traits. Le lissage (perfect-freehand) est fait à l'affichage :
 * on transmet des points bruts, chaque appareil les lisse à sa propre échelle.
 */
export function StrokeLayer({
  strokes,
  geometry,
  now,
  selfAuthor,
  isStudentAuthor = (author) => author === 'eleve',
}: {
  strokes: readonly Stroke[]
  geometry: ReadonlyMap<string, StrokeGeometry>
  now: number
  selfAuthor: string
  /** traits d'élève (binôme, crayon autorisé) : dessinés en pointillé */
  isStudentAuthor?: (author: string) => boolean
}) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden data-testid="strokes">
      <defs>
        <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {strokes.map((s) => {
        const g = geometry.get(s.id)
        if (!g || g.points.length === 0) return null
        const outline = getStroke(
          g.points.map((p) => [p.x, p.y]),
          { size: g.widthPx, thinning: 0.4, smoothing: 0.6, streamline: 0.5, simulatePressure: true, last: s.done },
        )
        const isLaser = s.style.tool === 'laser'
        // marquages du binôme / de l'élève : visuellement distincts de ceux du prof
        const fromStudent = isStudentAuthor(s.author)
        return (
          <path
            key={s.id}
            d={pathFromOutline(outline)}
            fill={isLaser ? '#ef4444' : COLOR_HEX[s.style.color]}
            opacity={(isLaser ? laserOpacity(s, now) : 0.85) * (fromStudent && s.author !== selfAuthor ? 0.7 : 1)}
            filter={isLaser ? 'url(#laser-glow)' : undefined}
            strokeDasharray={fromStudent ? '4 3' : undefined}
            stroke={fromStudent ? '#1d1a14' : undefined}
            strokeWidth={fromStudent ? 0.6 : undefined}
          />
        )
      })}
    </svg>
  )
}

import type { WordId } from '../quran/types'
import type { AnchorPoint, PxPoint, StrokeAnchor } from './anchors'

export const STROKE_COLORS = ['red', 'green', 'blue', 'yellow'] as const
export type StrokeColor = (typeof STROKE_COLORS)[number]

export type StrokeTool = 'pen' | 'laser'

export interface StrokeStyle {
  tool: StrokeTool
  color: StrokeColor
  /** épaisseur en fraction de la taille de police (em) */
  width: number
}

export interface Stroke {
  id: string
  author: string
  anchor: StrokeAnchor
  style: StrokeStyle
  points: AnchorPoint[]
  done: boolean
  /** horodatage de fin du trait (ms), utilisé pour faire disparaître le laser */
  endedAt?: number
}

export interface WordMark {
  id: string
  author: string
  words: WordId[]
  kind: 'highlight' | 'underline'
  color: StrokeColor
}

// ---------- laser ----------

export const LASER_TTL_MS = 2000

/** Opacité d'un trait laser : 1 tant qu'on dessine, puis fondu jusqu'à disparition. */
export function laserOpacity(stroke: Stroke, now: number, ttl = LASER_TTL_MS): number {
  if (stroke.style.tool !== 'laser') return 1
  if (!stroke.done || stroke.endedAt === undefined) return 1
  const age = now - stroke.endedAt
  if (age <= ttl / 2) return 1
  return Math.max(0, 1 - (age - ttl / 2) / (ttl / 2))
}

export const isLaserExpired = (stroke: Stroke, now: number, ttl = LASER_TTL_MS) =>
  stroke.style.tool === 'laser' && stroke.done && stroke.endedAt !== undefined && now - stroke.endedAt > ttl

// ---------- gomme ----------

function distanceToSegment(p: PxPoint, a: PxPoint, b: PxPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Le point `p` touche-t-il le tracé (en pixels écran) à moins de `radius` ? */
export function hitsPolyline(points: readonly PxPoint[], p: PxPoint, radius: number): boolean {
  if (points.length === 1) return Math.hypot(points[0]!.x - p.x, points[0]!.y - p.y) <= radius
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(p, points[i - 1]!, points[i]!) <= radius) return true
  }
  return false
}

// ---------- envoi en direct par petits lots ----------

/**
 * Les messages data de LiveKit sont limités en taille : on vise < 1 300 octets
 * par message pour rester dans la zone sûre, y compris en mode « lossy ».
 */
export const MAX_MESSAGE_BYTES = 1300
const QUANTUM = 10_000

/** Points quantifiés (entiers) pour des messages compacts : [x0, y0, x1, y1, …]. */
export function encodePoints(points: readonly AnchorPoint[]): number[] {
  const out: number[] = []
  for (const [x, y] of points) out.push(Math.round(x * QUANTUM), Math.round(y * QUANTUM))
  return out
}

export function decodePoints(flat: readonly number[]): AnchorPoint[] {
  const out: AnchorPoint[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i]! / QUANTUM, flat[i + 1]! / QUANTUM])
  return out
}

export const byteLength = (s: string) => new TextEncoder().encode(s).length

/**
 * Accumule les points d'un trait en cours et dit quand envoyer un lot :
 * dès `maxPoints` points ou `maxDelayMs` écoulées depuis le dernier envoi.
 */
export class StrokeBatcher {
  private pending: AnchorPoint[] = []
  private lastFlush: number

  constructor(
    now: number,
    private readonly maxPoints = 24,
    private readonly maxDelayMs = 40,
  ) {
    this.lastFlush = now
  }

  push(point: AnchorPoint, now: number): AnchorPoint[] | null {
    this.pending.push(point)
    if (this.pending.length >= this.maxPoints || now - this.lastFlush >= this.maxDelayMs) {
      return this.flush(now)
    }
    return null
  }

  flush(now: number): AnchorPoint[] | null {
    this.lastFlush = now
    if (this.pending.length === 0) return null
    const batch = this.pending
    this.pending = []
    return batch
  }
}

/** Ignore les points trop proches du précédent (réduit le volume sans perte visible). */
export function shouldKeepPoint(prev: AnchorPoint | undefined, next: AnchorPoint, minDistance: number): boolean {
  if (!prev) return true
  return Math.hypot(next[0] - prev[0], next[1] - prev[1]) >= minDistance
}

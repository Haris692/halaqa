import type { VerseKey } from '../quran/types'

/** Niveaux de masquage progressif du texte. */
export const MASK_LEVELS = ['full', 'faded', 'first', 'hidden'] as const
export type MaskLevel = (typeof MASK_LEVELS)[number]

export const nextMaskLevel = (level: MaskLevel): MaskLevel =>
  MASK_LEVELS[Math.min(MASK_LEVELS.indexOf(level) + 1, MASK_LEVELS.length - 1)]!

// ---------- test « continue le verset » ----------

export type Rng = () => number

/**
 * Tire un verset au hasard parmi les sourates apprises (chaque verset a la même
 * probabilité). Évite les `avoid` derniers tirages si c'est possible.
 */
export function pickRandomVerse(
  learned: readonly number[],
  verseCounts: ReadonlyMap<number, number>,
  rng: Rng,
  avoid: readonly VerseKey[] = [],
): VerseKey | null {
  const pool: VerseKey[] = []
  for (const s of learned) {
    const count = verseCounts.get(s) ?? 0
    for (let v = 1; v <= count; v++) pool.push(`${s}:${v}`)
  }
  if (pool.length === 0) return null
  const fresh = pool.filter((k) => !avoid.includes(k))
  const from = fresh.length ? fresh : pool
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))]!
}

// ---------- mode entraînement : écoute → lecture → récitation masquée ----------

export type TrainingStep =
  | { kind: 'listen'; repeat: number }
  | { kind: 'read' }
  | { kind: 'recite'; mask: Exclude<MaskLevel, 'full'> }

export function trainingPlan(listenRepeat: number): TrainingStep[] {
  return [
    { kind: 'listen', repeat: Math.max(1, Math.floor(listenRepeat)) },
    { kind: 'read' },
    { kind: 'recite', mask: 'first' },
    { kind: 'recite', mask: 'hidden' },
  ]
}

export interface TrainingState {
  steps: TrainingStep[]
  index: number
  done: boolean
}

export const startTraining = (listenRepeat: number): TrainingState => ({
  steps: trainingPlan(listenRepeat),
  index: 0,
  done: false,
})

export function advanceTraining(s: TrainingState): TrainingState {
  if (s.index + 1 >= s.steps.length) return { ...s, done: true }
  return { ...s, index: s.index + 1 }
}

export function backTraining(s: TrainingState): TrainingState {
  return { ...s, index: Math.max(0, s.index - 1), done: false }
}

/**
 * Logique pure des séances en direct : plan de séance, minuteur, répartition en salles.
 */

export const STEP_KEYS = ['opening', 'talqin', 'rooms', 'review', 'homework', 'custom'] as const
export type StepKey = (typeof STEP_KEYS)[number]

export interface PlanStep {
  key: StepKey
  /** titre libre (étape « custom » ou titre personnalisé) */
  title?: string
  minutes: number
}

/** Déroulé proposé pour 1 h (section 4 de la spécification), modifiable par le prof. */
export const DEFAULT_PLAN: readonly PlanStep[] = [
  { key: 'opening', minutes: 5 },
  { key: 'talqin', minutes: 10 },
  { key: 'rooms', minutes: 30 },
  { key: 'review', minutes: 10 },
  { key: 'homework', minutes: 5 },
]

/** Étapes qui se déroulent en salle principale (le passage à l'une d'elles rappelle tout le monde). */
export const MAIN_ROOM_STEPS: ReadonlySet<StepKey> = new Set(['opening', 'talqin', 'review', 'homework'])

export function planMinutes(plan: readonly PlanStep[]): number {
  return plan.reduce((sum, s) => sum + s.minutes, 0)
}

/** Secondes restantes dans l'étape (négatif = dépassement). */
export function stepRemaining(step: PlanStep | undefined, startedAt: string | null, now: number): number | null {
  if (!step || !startedAt) return null
  return Math.round((Date.parse(startedAt) + step.minutes * 60_000 - now) / 1000)
}

/** 125 → « 2:05 », -30 → « −0:30 ». */
export function formatTimer(seconds: number): string {
  const sign = seconds < 0 ? '−' : ''
  const s = Math.abs(seconds)
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Valide et normalise un plan venu de la base (JSON libre). */
export function parsePlan(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => {
    if (!v || typeof v !== 'object') return []
    const o = v as Record<string, unknown>
    const key = STEP_KEYS.includes(o.key as StepKey) ? (o.key as StepKey) : 'custom'
    const raw = Number(o.minutes)
    const minutes = Math.min(180, Math.max(1, Math.round(Number.isFinite(raw) ? raw : 5)))
    const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 60) : undefined
    return [{ key, minutes, ...(title ? { title } : {}) }]
  })
}

/** Mélange de Fisher-Yates (aléa injectable pour les tests). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Répartition aléatoire : des groupes de `size` (binômes par défaut).
 * Un élève restant rejoint le dernier groupe (trio) plutôt que de rester seul,
 * sauf en salles individuelles (size = 1).
 */
export function randomGroups<T>(ids: readonly T[], size = 2, random: () => number = Math.random): T[][] {
  if (ids.length === 0) return []
  const mixed = shuffle(ids, random)
  if (size <= 1) return mixed.map((id) => [id])
  const groups: T[][] = []
  for (let i = 0; i < mixed.length; i += size) groups.push(mixed.slice(i, i + size))
  const last = groups[groups.length - 1]!
  if (groups.length > 1 && last.length === 1) {
    groups.pop()
    groups[groups.length - 1]!.push(last[0]!)
  }
  return groups
}

/** Nombre de salles nécessaires pour `count` élèves. */
export function roomsFor(count: number, size = 2): number {
  if (count <= 0) return 1
  if (size <= 1) return count
  return Math.max(1, Math.floor(count / size))
}

/** Minutes écoulées depuis une date (null si jamais). */
export function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
}

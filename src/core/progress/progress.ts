/**
 * Statuts de versets (logique pure) : nouveau / en cours / acquis / à revoir.
 * Un verset sans ligne en base est « nouveau ».
 */

export const VERSE_STATUSES = ['new', 'learning', 'acquired', 'review'] as const
export type VerseStatus = (typeof VERSE_STATUSES)[number]

/** Statuts qu'un élève peut se donner lui-même : seul le prof valide « acquis ». */
export const SELF_STATUSES: readonly VerseStatus[] = ['new', 'learning', 'review']

export interface ProgressRow {
  surah: number
  ayah: number
  status: VerseStatus
}

export type StatusCounts = Record<VerseStatus, number>

export function emptyCounts(): StatusCounts {
  return { new: 0, learning: 0, acquired: 0, review: 0 }
}

/** Index « sourate:verset » → statut. */
export function progressMap(rows: readonly ProgressRow[]): Map<string, VerseStatus> {
  return new Map(rows.map((r) => [`${r.surah}:${r.ayah}`, r.status]))
}

export function statusOf(map: ReadonlyMap<string, VerseStatus>, surah: number, ayah: number): VerseStatus {
  return map.get(`${surah}:${ayah}`) ?? 'new'
}

/** Comptes par statut pour chaque sourate (`verseCounts[i]` = nombre de versets de la sourate i+1). */
export function countsBySurah(rows: readonly ProgressRow[], verseCounts: readonly number[]): StatusCounts[] {
  const out = verseCounts.map((n) => ({ ...emptyCounts(), new: n }))
  for (const r of rows) {
    const c = out[r.surah - 1]
    if (!c || r.ayah < 1 || r.ayah > verseCounts[r.surah - 1]! || r.status === 'new') continue
    c.new--
    c[r.status]++
  }
  return out
}

/** Statut dominant d'une sourate pour la colorer sur la carte de progression. */
export function surahSummary(c: StatusCounts): VerseStatus | 'partial' {
  const total = c.new + c.learning + c.acquired + c.review
  if (total === 0 || c.new === total) return 'new'
  if (c.acquired === total) return 'acquired'
  if (c.review > 0) return 'review'
  if (c.learning + c.acquired === total && c.learning > 0) return 'learning'
  return 'partial'
}

/** Lignes à écrire pour donner un statut à une plage de versets (bornes incluses, dans l'ordre). */
export function rangeRows(surah: number, from: number, to: number, status: VerseStatus): ProgressRow[] {
  const [a, b] = from <= to ? [from, to] : [to, from]
  return Array.from({ length: b - a + 1 }, (_, i) => ({ surah, ayah: a + i, status }))
}

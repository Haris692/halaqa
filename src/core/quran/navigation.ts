import type { QuranIndex, VerseKey } from './types'
import { parseVerseKey } from './types'

export const PAGE_COUNT = 604

export const clampPage = (p: number) => Math.min(PAGE_COUNT, Math.max(1, Math.round(p)))

/** Page du Mushaf contenant un verset, à partir de l'index des débuts de page. */
export function pageOfVerse(index: QuranIndex, key: VerseKey): number {
  const target = parseVerseKey(key)
  let lo = 0
  let hi = index.pages.length - 1
  let found = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const start = parseVerseKey(index.pages[mid]!.first)
    if (start.surah < target.surah || (start.surah === target.surah && start.verse <= target.verse)) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found + 1
}

export type Division = 'juz' | 'hizb' | 'rub'

/** Premier verset d'un juz (1–30), hizb (1–60) ou quart de hizb (1–240). */
export function divisionStart(index: QuranIndex, division: Division, n: number): VerseKey | null {
  return index[division][n - 1] ?? null
}

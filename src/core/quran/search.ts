import type { SurahMeta } from './types'

/** Arabe : sans harakat ni signes coraniques, formes d'alif unifiées, ى→ي, ة→ه. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
}

/** Latin : minuscules, sans accents, sans apostrophes ni tirets ni espaces. */
export function normalizeLatin(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const stripArticle = (s: string) => s.replace(/^(al|an|ar|as|at|ad|adh|az|ash|aal)(?=[a-z]{3,})/, '')

/**
 * Recherche de sourate par numéro, nom arabe, nom français ou translittération.
 * Résultats triés : numéro exact, puis début de nom, puis contenu.
 */
export function searchSurahs(all: readonly SurahMeta[], query: string): SurahMeta[] {
  const q = query.trim()
  if (!q) return [...all]
  if (/^\d+$/.test(q)) {
    const n = Number(q)
    return all.filter((s) => s.n === n || String(s.n).startsWith(q)).sort((a, b) => (a.n === n ? -1 : b.n === n ? 1 : a.n - b.n))
  }
  const isArabic = /[؀-ۿ]/.test(q)
  const nq = isArabic ? normalizeArabic(q) : normalizeLatin(q)
  const nqBare = isArabic ? nq : stripArticle(nq)
  const scored: { s: SurahMeta; score: number }[] = []
  for (const s of all) {
    const fields = isArabic
      ? [normalizeArabic(s.ar)]
      : [s.translit, s.simple, s.fr].map(normalizeLatin).flatMap((f) => [f, stripArticle(f)])
    let score = Infinity
    for (const f of fields) {
      if (f === nq || f === nqBare) score = Math.min(score, 0)
      else if (f.startsWith(nq) || f.startsWith(nqBare)) score = Math.min(score, 1)
      else if (f.includes(nqBare)) score = Math.min(score, 2)
    }
    if (score < Infinity) scored.push({ s, score })
  }
  return scored.sort((a, b) => a.score - b.score || a.s.n - b.s.n).map((x) => x.s)
}

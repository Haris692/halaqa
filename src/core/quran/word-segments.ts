import { joinsToNext, splitLetters, ZWJ } from '../audio-sync/letters'
import type { TajweedSpan } from './types'

/**
 * Découpe le texte d'un mot en morceaux à styliser séparément (couleur de
 * tajwid, partie masquée…). La concaténation des `text` (ZWJ retirés) redonne
 * TOUJOURS exactement le texte d'origine : rien n'est modifié.
 *
 * Aux frontières qui coupent une liaison, on ajoute des ZWJ (U+200D, invisibles)
 * pour que les navigateurs qui ne lient pas les lettres à travers deux balises
 * (Safari notamment) gardent les bonnes formes contextuelles.
 */
export interface WordSegment {
  text: string
  /** règle de tajwid, ou null */
  rule: string | null
  /** true pour la partie masquée au niveau « première lettre » */
  rest: boolean
}

export interface SegmentOptions {
  tajweed?: readonly TajweedSpan[] | undefined
  /** ne garder que ces règles (règle de la semaine) ; undefined = toutes */
  ruleFilter?: ((rule: string) => boolean) | undefined
  /** offset de fin de la partie visible (niveau « première lettre ») */
  visibleEnd?: number | undefined
}

export function wordSegments(text: string, opts: SegmentOptions = {}): WordSegment[] {
  const cuts = new Set<number>([0, text.length])
  const rules = (opts.tajweed ?? []).filter(([, , r]) => !opts.ruleFilter || opts.ruleFilter(r))
  for (const [s, e] of rules) {
    cuts.add(Math.max(0, Math.min(text.length, s)))
    cuts.add(Math.max(0, Math.min(text.length, e)))
  }
  if (opts.visibleEnd !== undefined) cuts.add(opts.visibleEnd)
  const points = [...cuts].sort((a, b) => a - b)

  const raw: { start: number; end: number; rule: string | null; rest: boolean }[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const start = points[i]!
    const end = points[i + 1]!
    if (end <= start) continue
    const rule = rules.find(([s, e]) => s <= start && end <= e)?.[2] ?? null
    const rest = opts.visibleEnd !== undefined && start >= opts.visibleEnd
    const prev = raw[raw.length - 1]
    if (prev && prev.rule === rule && prev.rest === rest) prev.end = end
    else raw.push({ start, end, rule, rest })
  }
  if (raw.length <= 1) return raw.map((r) => ({ text: text.slice(r.start, r.end), rule: r.rule, rest: r.rest }))

  return raw.map((r, i) => {
    let s = text.slice(r.start, r.end)
    const before = text.slice(0, r.start)
    const prevBase = lastBaseLetter(before)
    const firstBase = firstBaseLetter(s)
    if (i > 0 && prevBase && firstBase && joinsToNext(prevBase)) s = ZWJ + s
    const after = text.slice(r.end)
    const lastBase = lastBaseLetter(text.slice(r.start, r.end))
    const nextBase = firstBaseLetter(after)
    if (i < raw.length - 1 && lastBase && nextBase && joinsToNext(lastBase)) s = s + ZWJ
    return { text: s, rule: r.rule, rest: r.rest }
  })
}

const isLetter = (c: string) => /[ؠ-يٮ-ۓەٱ]/.test(c)
function lastBaseLetter(s: string): string | null {
  for (let i = s.length - 1; i >= 0; i--) if (isLetter(s[i]!)) return s[i]!
  return null
}
function firstBaseLetter(s: string): string | null {
  for (const c of s) if (isLetter(c)) return c
  return null
}

/**
 * Fin de la partie visible au niveau de masquage « première lettre ».
 * Si le mot commence par un alif wasla (ٱ, muet en liaison), on montre aussi
 * la lettre suivante : « ٱلۡ… » plutôt qu'un « ٱ » seul, inutilisable.
 */
export function firstLetterEnd(text: string): number {
  const letters = splitLetters(text)
  if (letters.length === 0) return 0
  const first = letters[0]!
  if (first.text.startsWith('ٱ') && letters[1]) return letters[1].end
  return first.end
}

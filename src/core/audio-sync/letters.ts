/**
 * Découpage d'un mot arabe en « lettres » (clusters de graphèmes : lettre de base
 * + harakat et signes coraniques) et interpolation du minutage à l'intérieur du mot.
 *
 * Les données de minutage s'arrêtent au mot : la position de la lettre en cours est
 * donc estimée, avec une pondération simple (les lettres de prolongation durent plus
 * longtemps, les lettres muettes presque pas). C'est une heuristique, pas une vérité.
 */

export interface LetterCluster {
  text: string
  /** offsets en unités UTF-16 dans le texte du mot : [start, end) */
  start: number
  end: number
  weight: number
}

const FATHA = 'َ'
const DAMMA = 'ُ'
const KASRA = 'ِ'
const SHADDA = 'ّ'
const SUKUN_MARKS = ['ْ', 'ۡ'] // sukun classique et sukun QPC (ۡ)
const TANWIN = ['ً', 'ٌ', 'ٍ', 'ࣰ', 'ࣱ', 'ࣲ']
const MADDAH = 'ٓ' // ٓ  madd obligatoire (lazim, muttasil, munfasil)
const DAGGER_ALIF = 'ٰ' // ٰ  alif suscrit = madd naturel
const SILENT_MARK = '۟' // ۟  lettre non prononcée
const ALIF_WASLA = 'ٱ' // ٱ

const VOWEL_MARKS = [FATHA, DAMMA, KASRA, SHADDA, ...SUKUN_MARKS, ...TANWIN]
const LONG_VOWEL_LETTERS = ['ا', 'و', 'ي', 'ى'] // ا و ي ى
const NASAL_LETTERS = ['ن', 'م'] // ن م (ghunna sur shadda)

const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' })

export function letterWeight(cluster: string, isFirst: boolean): number {
  const base = cluster[0] ?? ''
  const marks = cluster.slice(1)
  if (marks.includes(SILENT_MARK)) return 0.2
  if (base === ALIF_WASLA && isFirst) return 0.2
  let weight = 1
  if (marks.includes(SHADDA)) weight = NASAL_LETTERS.includes(base) ? 2 : 1.5
  if (marks.includes(DAGGER_ALIF)) weight += 1
  const hasVowel = VOWEL_MARKS.some((m) => marks.includes(m))
  if (LONG_VOWEL_LETTERS.includes(base) && !hasVowel) weight = 2
  if (marks.includes(MADDAH) || base === 'آ') weight = 4 // ٓ ou آ précomposé
  return weight
}

export function splitLetters(word: string): LetterCluster[] {
  const clusters: LetterCluster[] = []
  for (const { segment, index } of segmenter.segment(word)) {
    clusters.push({
      text: segment,
      start: index,
      end: index + segment.length,
      weight: letterWeight(segment, clusters.length === 0),
    })
  }
  return clusters
}

/** Indice de la lettre en cours pour une progression `progress` ∈ [0, 1] dans le mot. */
export function letterIndexAt(clusters: readonly LetterCluster[], progress: number): number {
  if (clusters.length === 0) return -1
  const total = clusters.reduce((sum, c) => sum + c.weight, 0)
  const target = Math.min(Math.max(progress, 0), 1) * total
  let acc = 0
  for (let i = 0; i < clusters.length; i++) {
    acc += clusters[i]!.weight
    if (target < acc) return i
  }
  return clusters.length - 1
}

export function wordProgress(ms: number, start: number, end: number): number {
  if (end <= start) return 1
  return (ms - start) / (end - start)
}

// ---------- jointure (pour l'approche « spans + ZWJ ») ----------

/**
 * Lettres qui ne se lient pas à la lettre suivante (type de jointure R ou U).
 * Toute autre lettre arabe est considérée comme bilatérale (D).
 */
const NON_LEFT_JOINING = new Set([
  'ء', // ء
  'آ', // آ
  'أ', // أ
  'ؤ', // ؤ
  'إ', // إ
  'ا', // ا
  'ة', // ة
  'د', // د
  'ذ', // ذ
  'ر', // ر
  'ز', // ز
  'و', // و
  'ٱ', // ٱ
  'ٲ',
  'ٳ',
  'ٵ',
  'ٶ',
  'ٷ',
  'ۥ', // ۥ petit waw
  'ۦ', // ۦ petit ya
])

const isArabicLetter = (ch: string) => /[ؠ-يٮ-ۓەۺ-ۿـ]/.test(ch)

/** La lettre de base de ce cluster se lie-t-elle à la suivante ? */
export function joinsToNext(cluster: string): boolean {
  const base = cluster[0] ?? ''
  return isArabicLetter(base) && !NON_LEFT_JOINING.has(base)
}

export const ZWJ = '‍'

/**
 * Texte de chaque cluster encadré de ZWJ là où il y a une liaison, pour que le
 * découpage en <span> ne casse pas les formes contextuelles.
 */
export function clustersWithJoiners(clusters: readonly LetterCluster[]): string[] {
  return clusters.map((c, i) => {
    const prev = clusters[i - 1]
    const next = clusters[i + 1]
    const joinBefore = prev !== undefined && joinsToNext(prev.text) && isArabicLetter(c.text[0] ?? '')
    const joinAfter = next !== undefined && joinsToNext(c.text) && isArabicLetter(next.text[0] ?? '')
    return (joinBefore ? ZWJ : '') + c.text + (joinAfter ? ZWJ : '')
  })
}

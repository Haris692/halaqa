/** Identifiant stable d'un mot : `sourate:verset:position` (position 1-based). */
export type WordId = `${number}:${number}:${number}`
/** Identifiant d'un verset : `sourate:verset`. */
export type VerseKey = `${number}:${number}`

export const wordId = (surah: number, verse: number, position: number): WordId =>
  `${surah}:${verse}:${position}`
export const verseKey = (surah: number, verse: number): VerseKey => `${surah}:${verse}`

export function parseWordId(id: WordId): { surah: number; verse: number; position: number } {
  const [surah, verse, position] = id.split(':').map(Number)
  return { surah: surah!, verse: verse!, position: position! }
}

export function parseVerseKey(key: VerseKey): { surah: number; verse: number } {
  const [surah, verse] = key.split(':').map(Number)
  return { surah: surah!, verse: verse! }
}

/** Règle de tajwid sur une plage [début, fin) du texte du mot (unités UTF-16). */
export type TajweedSpan = readonly [start: number, end: number, rule: string]

/** Mot tel que servi dans public/quran/text/NNN.json. */
export interface QuranWord {
  /** position dans le verset (1-based) */
  p: number
  /** texte Unicode QPC Hafs — jamais modifié */
  t: string
  /** glyphe de la police QPC V2 de la page */
  g: string
  /** ligne du Mushaf (1–15) */
  l: number
  /** page du Mushaf */
  pg?: number
  /** règles de tajwid */
  r?: TajweedSpan[]
}

export interface QuranVerse {
  n: number
  page: number
  juz: number
  hizb: number
  rub?: number
  sajda?: true
  words: QuranWord[]
  /** marqueur de fin de verset (numéro orné) */
  end: { t: string; g: string; l: number; pg?: number }
}

export interface SurahText {
  surah: number
  verses: QuranVerse[]
}

export interface SurahMeta {
  n: number
  ar: string
  translit: string
  simple: string
  fr: string
  verses: number
  pages: [number, number]
  bismillah: boolean
  place: string
}

/** Mot d'une page du Mushaf : `k` = `sourate:verset:position` ou `sourate:verset:end`. */
export interface PageWord {
  k: string
  t: string
  g: string
  e?: 1
}

export type MushafLine =
  | { n: number; type: 'text'; words: PageWord[] }
  | { n: number; type: 'surah'; surah: number }
  | { n: number; type: 'basmala' }

export interface MushafPage {
  page: number
  lines: MushafLine[]
}

/** public/quran/index.json : début de chaque page, juz, hizb et quart de hizb. */
export interface QuranIndex {
  pages: { first: VerseKey; surahs: number[] }[]
  juz: VerseKey[]
  hizb: VerseKey[]
  rub: VerseKey[]
}

/** Segment de minutage : [position du mot, début ms, fin ms]. */
export type Segment = readonly [position: number, startMs: number, endMs: number]

export interface GaplessRecitation {
  format: 'gapless'
  audio: string
  durationMs: number
  verses: Record<VerseKey, { from: number; to: number; segs: Segment[] }>
}

export interface AyahRecitation {
  format: 'ayah'
  verses: Record<VerseKey, { audio: string; segs: Segment[] }>
}

export type Recitation = GaplessRecitation | AyahRecitation

export interface ReciterInfo {
  id: string
  name: string
  nameAr: string
  style: string
}

export interface TextSource {
  key: string
  title: string
  author: string
  source: string
  url: string
  note?: string
  lang?: 'fr' | 'ar'
}

export interface SourcesIndex {
  translations: TextSource[]
  tafsirs: TextSource[]
}

/** Traduction ou tafsir d'un verset. `g` = plage de versets couverte par un commentaire commun. */
export interface VerseCommentary {
  t: string
  f?: string
  g?: [number, number]
}
export type SurahCommentary = Record<string, VerseCommentary>

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
}

export interface QuranVerse {
  n: number
  page: number
  juz: number
  hizb: number
  words: QuranWord[]
  /** marqueur de fin de verset (numéro orné) */
  end: QuranWord
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

export type MushafLine =
  | { n: number; type: 'text'; words: string[] }
  | { n: number; type: 'surah'; surah: number }
  | { n: number; type: 'basmala' }

export interface MushafPage {
  page: number
  lines: MushafLine[]
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

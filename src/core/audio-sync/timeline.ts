import type { Recitation, VerseKey } from '../quran/types'

/** Un mot minuté, en ms relatives au début de la piste audio qui le contient. */
export interface TimedWord {
  verse: VerseKey
  position: number
  start: number
  end: number
}

export interface TimedVerse {
  key: VerseKey
  from: number
  to: number
}

/** Une piste = un fichier audio (une sourate entière, ou un seul verset). */
export interface Track {
  src: string
  verses: TimedVerse[]
  /** triés par `start` croissant */
  words: TimedWord[]
}

export interface Timeline {
  tracks: Track[]
}

/**
 * Normalise les deux formats de récitation (sourate complète « gapless » ou
 * verset par verset) en une liste de pistes, dans l'ordre des versets demandés.
 */
export function buildTimeline(rec: Recitation, order: VerseKey[]): Timeline {
  if (rec.format === 'gapless') {
    const verses: TimedVerse[] = []
    const words: TimedWord[] = []
    for (const key of order) {
      const v = rec.verses[key]
      if (!v) continue
      verses.push({ key, from: v.from, to: v.to })
      for (const [position, start, end] of v.segs) words.push({ verse: key, position, start, end })
    }
    words.sort((a, b) => a.start - b.start)
    return { tracks: [{ src: rec.audio, verses, words }] }
  }

  const tracks: Track[] = []
  for (const key of order) {
    const v = rec.verses[key]
    if (!v) continue
    const words = v.segs
      .map(([position, start, end]) => ({ verse: key, position, start, end }))
      .sort((a, b) => a.start - b.start)
    const to = words.length ? words[words.length - 1]!.end : 0
    tracks.push({ src: v.audio, verses: [{ key, from: 0, to }], words })
  }
  return { tracks }
}

/** Indice du dernier élément dont `start` (ou `from`) est ≤ ms ; -1 s'il n'y en a aucun. */
export function lastStartedIndex<T>(items: readonly T[], ms: number, startOf: (item: T) => number): number {
  let lo = 0
  let hi = items.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (startOf(items[mid]!) <= ms) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/**
 * Mot en cours à l'instant `ms`. Dans les petits silences entre deux mots
 * (≤ holdGapMs), on garde le mot précédent surligné pour éviter le clignotement.
 */
export function activeWordAt(track: Track, ms: number, holdGapMs = 250): TimedWord | null {
  const i = lastStartedIndex(track.words, ms, (w) => w.start)
  if (i < 0) return null
  const word = track.words[i]!
  if (ms < word.end) return word
  const next = track.words[i + 1]
  const gapEnd = next ? Math.min(next.start, word.end + holdGapMs) : word.end + holdGapMs
  return ms < gapEnd ? word : null
}

export function activeVerseAt(track: Track, ms: number): TimedVerse | null {
  const i = lastStartedIndex(track.verses, ms, (v) => v.from)
  if (i < 0) return null
  const verse = track.verses[i]!
  return ms < verse.to ? verse : null
}

/** Localise un verset : quelle piste, et à partir de quel instant. */
export function locateVerse(timeline: Timeline, key: VerseKey): { trackIndex: number; verse: TimedVerse } | null {
  for (let t = 0; t < timeline.tracks.length; t++) {
    const verse = timeline.tracks[t]!.verses.find((v) => v.key === key)
    if (verse) return { trackIndex: t, verse }
  }
  return null
}

export function locateWord(
  timeline: Timeline,
  key: VerseKey,
  position: number,
): { trackIndex: number; word: TimedWord } | null {
  for (let t = 0; t < timeline.tracks.length; t++) {
    const word = timeline.tracks[t]!.words.find((w) => w.verse === key && w.position === position)
    if (word) return { trackIndex: t, word }
  }
  return null
}

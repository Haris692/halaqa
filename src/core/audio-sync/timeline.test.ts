import { describe, expect, it } from 'vitest'
import type { AyahRecitation, GaplessRecitation } from '../quran/types'
import { activeVerseAt, activeWordAt, buildTimeline, lastStartedIndex, locateWord } from './timeline'

const gapless: GaplessRecitation = {
  format: 'gapless',
  audio: '/a.mp3',
  durationMs: 10_000,
  verses: {
    '1:2': { from: 4000, to: 9000, segs: [[1, 4000, 5000], [2, 5200, 6000]] },
    '1:1': { from: 0, to: 4000, segs: [[1, 0, 1000], [2, 1000, 2000], [3, 2500, 3500]] },
  },
}

const ayah: AyahRecitation = {
  format: 'ayah',
  verses: {
    '1:1': { audio: '/001001.mp3', segs: [[1, 100, 600], [2, 600, 1200]] },
    '1:2': { audio: '/001002.mp3', segs: [[1, 80, 500]] },
  },
}

describe('buildTimeline', () => {
  it('gapless : une seule piste, mots triés, versets dans l’ordre demandé', () => {
    const tl = buildTimeline(gapless, ['1:1', '1:2'])
    expect(tl.tracks).toHaveLength(1)
    expect(tl.tracks[0]!.verses.map((v) => v.key)).toEqual(['1:1', '1:2'])
    expect(tl.tracks[0]!.words.map((w) => w.start)).toEqual([0, 1000, 2500, 4000, 5200])
  })

  it('verset par verset : une piste par verset, fin = fin du dernier mot', () => {
    const tl = buildTimeline(ayah, ['1:1', '1:2'])
    expect(tl.tracks.map((t) => t.src)).toEqual(['/001001.mp3', '/001002.mp3'])
    expect(tl.tracks[0]!.verses[0]).toEqual({ key: '1:1', from: 0, to: 1200 })
  })

  it('ignore les versets absents de la récitation', () => {
    expect(buildTimeline(ayah, ['1:1', '1:9']).tracks).toHaveLength(1)
  })
})

describe('recherche binaire', () => {
  const items = [0, 10, 20, 30]
  it.each([
    [-5, -1],
    [0, 0],
    [15, 1],
    [30, 3],
    [999, 3],
  ])('ms=%i → indice %i', (ms, expected) => {
    expect(lastStartedIndex(items, ms, (x) => x)).toBe(expected)
  })
  it('liste vide', () => expect(lastStartedIndex([], 5, (x: number) => x)).toBe(-1))
})

describe('activeWordAt', () => {
  const track = buildTimeline(gapless, ['1:1', '1:2']).tracks[0]!

  it('trouve le mot en cours', () => {
    expect(activeWordAt(track, 1500)).toMatchObject({ verse: '1:1', position: 2 })
  })
  it('garde le mot précédent pendant un petit silence', () => {
    expect(activeWordAt(track, 2100, 250)).toMatchObject({ position: 2 })
  })
  it('ne garde rien au-delà du silence toléré', () => {
    expect(activeWordAt(track, 2300, 250)).toBeNull()
  })
  it('ne déborde jamais sur le mot suivant', () => {
    expect(activeWordAt(track, 5100, 250)).toMatchObject({ verse: '1:2', position: 1 })
    expect(activeWordAt(track, 5200, 250)).toMatchObject({ verse: '1:2', position: 2 })
  })
  it('rien avant le premier mot', () => {
    const t = buildTimeline(ayah, ['1:1']).tracks[0]!
    expect(activeWordAt(t, 50)).toBeNull()
  })
})

describe('activeVerseAt / locateWord', () => {
  const tl = buildTimeline(gapless, ['1:1', '1:2'])
  it('verset en cours', () => {
    expect(activeVerseAt(tl.tracks[0]!, 4500)?.key).toBe('1:2')
    expect(activeVerseAt(tl.tracks[0]!, 9500)).toBeNull()
  })
  it('localise un mot pour « toucher un mot = l’écouter seul »', () => {
    expect(locateWord(tl, '1:2', 2)).toEqual({
      trackIndex: 0,
      word: { verse: '1:2', position: 2, start: 5200, end: 6000 },
    })
  })
})

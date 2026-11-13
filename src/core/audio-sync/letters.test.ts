import { describe, expect, it } from 'vitest'
import { clustersWithJoiners, joinsToNext, letterIndexAt, letterWeight, splitLetters, ZWJ } from './letters'

describe('splitLetters', () => {
  it('regroupe chaque lettre avec ses harakat (بِسۡمِ → 3 lettres)', () => {
    const clusters = splitLetters('بِسۡمِ')
    expect(clusters.map((c) => c.text)).toEqual(['بِ', 'سۡ', 'مِ'])
    expect(clusters.map((c) => [c.start, c.end])).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
    ])
  })

  it('ne perd ni n’ajoute aucun caractère', () => {
    const word = 'ٱلرَّحۡمَٰنِ'
    expect(
      splitLetters(word)
        .map((c) => c.text)
        .join(''),
    ).toBe(word)
  })
})

describe('letterWeight', () => {
  it('alif wasla initial presque muet', () => expect(letterWeight('ٱ', true)).toBeLessThan(0.5))
  it('alif de prolongation plus long qu’une consonne', () => expect(letterWeight('ا', false)).toBe(2))
  it('madd obligatoire (آ précomposé) le plus long', () => expect(letterWeight('آ', false)).toBe(4))
  it('maddah en signe combinant', () => expect(letterWeight('آ', false)).toBe(4))
  it('lettre marquée muette (۟)', () => expect(letterWeight('و۟', false)).toBe(0.2))
  it('nun avec shadda : ghunna', () => expect(letterWeight('نّ', false)).toBe(2))
})

describe('letterIndexAt', () => {
  const clusters = splitLetters('بِسۡمِ')
  it('début, milieu et fin du mot', () => {
    expect(letterIndexAt(clusters, 0)).toBe(0)
    expect(letterIndexAt(clusters, 0.5)).toBe(1)
    expect(letterIndexAt(clusters, 0.99)).toBe(2)
    expect(letterIndexAt(clusters, 1)).toBe(2)
  })
  it('borne les progressions hors [0, 1]', () => {
    expect(letterIndexAt(clusters, -1)).toBe(0)
    expect(letterIndexAt(clusters, 3)).toBe(2)
  })
  it('monotone', () => {
    const word = splitLetters('ٱلۡحَمۡدُ')
    let prev = 0
    for (let p = 0; p <= 1; p += 0.01) {
      const i = letterIndexAt(word, p)
      expect(i).toBeGreaterThanOrEqual(prev)
      prev = i
    }
  })
})

describe('jointure (approche spans + ZWJ)', () => {
  it('د et ا ne se lient pas à la lettre suivante', () => {
    expect(joinsToNext('د')).toBe(false)
    expect(joinsToNext('ا')).toBe(false)
    expect(joinsToNext('بِ')).toBe(true)
  })

  it('ajoute des ZWJ seulement là où les lettres se lient', () => {
    const parts = clustersWithJoiners(splitLetters('بِسۡمِ'))
    expect(parts).toEqual([`بِ${ZWJ}`, `${ZWJ}سۡ${ZWJ}`, `${ZWJ}مِ`])
  })

  it('pas de ZWJ après une lettre non liante (قَالَ)', () => {
    const parts = clustersWithJoiners(splitLetters('قَالَ'))
    expect(parts).toEqual([`قَ${ZWJ}`, `${ZWJ}ا`, 'لَ'])
  })
})

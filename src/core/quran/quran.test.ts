import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ZWJ } from '../audio-sync/letters'
import { ruleFilterFor } from '../tajweed/rules'
import { divisionStart, pageOfVerse } from './navigation'
import { normalizeArabic, normalizeLatin, searchSurahs } from './search'
import type { QuranIndex, SurahMeta, SurahText } from './types'
import { firstLetterEnd, wordSegments } from './word-segments'

// Tests sur les VRAIES données importées (public/quran) : ils échouent si l'import est cassé.
const DATA = join(import.meta.dirname, '../../../public/quran')
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(DATA, path), 'utf8')) as T
const meta = readJson<SurahMeta[]>('meta.json')
const index = readJson<QuranIndex>('index.json')
const pad3 = (n: number) => String(n).padStart(3, '0')

describe('recherche de sourate', () => {
  it.each([
    ['2', 2],
    ['fatiha', 1],
    ['Al-Fâtiha', 1],
    ['ikhlas', 112],
    ['la vache', 2],
    ['البقرة', 2],
    ['الاخلاص', 112],
    ['yasin', 36],
    ['nas', 114],
  ])('« %s » → sourate %i en premier', (q, n) => {
    expect(searchSurahs(meta, q)[0]?.n).toBe(n)
  })
  it('requête vide : les 114 sourates', () => expect(searchSurahs(meta, '  ')).toHaveLength(114))
  it('normalisations', () => {
    expect(normalizeArabic('ٱلۡفَاتِحَة')).toBe('الفاتحه')
    expect(normalizeLatin("Al-Fātiḥah")).toBe('alfatihah')
  })
})

describe('navigation', () => {
  it('page d’un verset', () => {
    expect(pageOfVerse(index, '1:1')).toBe(1)
    expect(pageOfVerse(index, '2:1')).toBe(2)
    expect(pageOfVerse(index, '2:255')).toBe(42)
    expect(pageOfVerse(index, '114:6')).toBe(604)
  })
  it('début des juz, hizb et quarts', () => {
    expect(divisionStart(index, 'juz', 1)).toBe('1:1')
    expect(divisionStart(index, 'juz', 30)).toBe('78:1')
    expect(divisionStart(index, 'hizb', 60)).toBe('87:1')
    expect(divisionStart(index, 'rub', 241)).toBeNull()
  })
})

describe('découpage des mots (tajwid, masquage)', () => {
  const strip = (s: string) => s.replaceAll(ZWJ, '')

  it('n’altère AUCUN mot du Coran (6 236 versets, avec et sans tajwid)', () => {
    let words = 0
    for (let s = 1; s <= 114; s++) {
      const text = readJson<SurahText>(`text/${pad3(s)}.json`)
      for (const v of text.verses) {
        for (const w of v.words) {
          words++
          const withRules = wordSegments(w.t, { tajweed: w.r })
          const masked = wordSegments(w.t, { tajweed: w.r, visibleEnd: firstLetterEnd(w.t) })
          const madd = wordSegments(w.t, { tajweed: w.r, ruleFilter: ruleFilterFor('madd') })
          for (const segs of [withRules, masked, madd]) {
            const joined = segs.map((x) => strip(x.text)).join('')
            if (joined !== w.t) throw new Error(`${s}:${v.n}:${w.p} altéré`)
          }
        }
      }
    }
    expect(words).toBe(77430)
  })

  it('qalqala sur le د de أَحَدٌ (112:1:4)', () => {
    const w = readJson<SurahText>('text/112.json').verses[0]!.words[3]!
    const segs = wordSegments(w.t, { tajweed: w.r })
    expect(segs.find((x) => x.rule === 'qalaqah')).toBeDefined()
  })

  it('filtre « règle de la semaine »', () => {
    const segs = wordSegments('abcdef', { tajweed: [[0, 2, 'qalaqah'], [3, 5, 'madda_normal']], ruleFilter: ruleFilterFor('madd') })
    expect(segs.map((x) => x.rule)).toEqual([null, 'madda_normal', null])
  })

  it('première lettre : alif wasla accompagné de la lettre suivante', () => {
    expect(firstLetterEnd('بِسۡمِ')).toBe(2)
    expect('ٱلۡحَمۡدُ'.slice(0, firstLetterEnd('ٱلۡحَمۡدُ'))).toBe('ٱلۡ')
  })

  it('ZWJ aux frontières qui coupent une liaison seulement', () => {
    const segs = wordSegments('بِسۡمِ', { visibleEnd: 2 })
    expect(segs.map((s) => s.text)).toEqual([`بِ${ZWJ}`, `${ZWJ}سۡمِ`])
    expect(segs[1]!.rest).toBe(true)
  })
})

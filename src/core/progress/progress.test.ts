import { describe, expect, it } from 'vitest'
import { formatInviteCode, inviteLink, parseInviteInput } from './invite'
import { countsBySurah, progressMap, rangeRows, statusOf, surahSummary } from './progress'

describe('statuts de versets', () => {
  const rows = [
    { surah: 1, ayah: 1, status: 'acquired' as const },
    { surah: 1, ayah: 2, status: 'learning' as const },
    { surah: 2, ayah: 5, status: 'review' as const },
    { surah: 2, ayah: 999, status: 'acquired' as const }, // hors sourate : ignoré
  ]
  it('compte par sourate, les versets absents sont « nouveaux »', () => {
    const c = countsBySurah(rows, [7, 286])
    expect(c[0]).toEqual({ new: 5, learning: 1, acquired: 1, review: 0 })
    expect(c[1]).toEqual({ new: 285, learning: 0, acquired: 0, review: 1 })
  })
  it('résume une sourate', () => {
    expect(surahSummary({ new: 7, learning: 0, acquired: 0, review: 0 })).toBe('new')
    expect(surahSummary({ new: 0, learning: 0, acquired: 7, review: 0 })).toBe('acquired')
    expect(surahSummary({ new: 0, learning: 3, acquired: 4, review: 0 })).toBe('learning')
    expect(surahSummary({ new: 0, learning: 0, acquired: 6, review: 1 })).toBe('review')
    expect(surahSummary({ new: 5, learning: 1, acquired: 1, review: 0 })).toBe('partial')
  })
  it('lit un statut', () => {
    const m = progressMap(rows)
    expect(statusOf(m, 1, 1)).toBe('acquired')
    expect(statusOf(m, 1, 3)).toBe('new')
  })
  it('génère une plage dans l\'ordre, bornes inversées acceptées', () => {
    expect(rangeRows(112, 4, 2, 'learning').map((r) => r.ayah)).toEqual([2, 3, 4])
  })
})

describe('codes d\'invitation', () => {
  it('accepte le code seul, avec tiret, espaces ou minuscules', () => {
    expect(parseInviteInput('abcde-fghjk')).toBe('ABCDEFGHJK')
    expect(parseInviteInput('  ABCDE FGHJK ')).toBe('ABCDEFGHJK')
  })
  it('extrait le code d\'un lien', () => {
    expect(parseInviteInput('https://haris692.github.io/halaqa/rejoindre/ABCDEFGHJK')).toBe('ABCDEFGHJK')
  })
  it('refuse les codes mal formés (caractères ambigus, longueur)', () => {
    expect(parseInviteInput('ABCDEFGHJ0')).toBeNull()
    expect(parseInviteInput('ABC')).toBeNull()
    expect(parseInviteInput('')).toBeNull()
  })
  it('formate et construit le lien', () => {
    expect(formatInviteCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK')
    expect(inviteLink('https://x.io', '/halaqa/', 'ABCDEFGHJK')).toBe('https://x.io/halaqa/rejoindre/ABCDEFGHJK')
    expect(inviteLink('http://localhost:5173', '/', 'ABCDEFGHJK')).toBe('http://localhost:5173/rejoindre/ABCDEFGHJK')
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAN, formatTimer, minutesSince, parsePlan, planMinutes, randomGroups, roomsFor, shuffle, stepRemaining } from './live'

/** Générateur pseudo-aléatoire déterministe. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed / 2 ** 31
  }
}

describe('plan de séance', () => {
  it('le déroulé par défaut dure une heure', () => {
    expect(planMinutes(DEFAULT_PLAN)).toBe(60)
  })
  it('minuteur : restant et dépassement', () => {
    const start = '2026-11-15T10:00:00Z'
    expect(stepRemaining({ key: 'opening', minutes: 5 }, start, Date.parse('2026-11-15T10:02:00Z'))).toBe(180)
    expect(stepRemaining({ key: 'opening', minutes: 5 }, start, Date.parse('2026-11-15T10:06:00Z'))).toBe(-60)
    expect(stepRemaining(undefined, start, 0)).toBeNull()
    expect(formatTimer(125)).toBe('2:05')
    expect(formatTimer(-30)).toBe('−0:30')
  })
  it('valide un plan venu de la base', () => {
    expect(parsePlan([{ key: 'talqin', minutes: '12' }, { key: 'inconnu', minutes: 0, title: ' Quiz ' }, null])).toEqual([
      { key: 'talqin', minutes: 12 },
      { key: 'custom', minutes: 1, title: 'Quiz' },
    ])
    expect(parsePlan('n importe quoi')).toEqual([])
  })
})

describe('répartition en salles', () => {
  const five = ['a', 'b', 'c', 'd', 'e']
  it('mélange sans perdre ni dupliquer', () => {
    expect(shuffle(five, seeded(1)).sort()).toEqual(five)
  })
  it('binômes, le cinquième forme un trio', () => {
    const groups = randomGroups(five, 2, seeded(7))
    expect(groups.map((g) => g.length)).toEqual([2, 3])
    expect(groups.flat().sort()).toEqual(five)
  })
  it('salles individuelles', () => {
    expect(randomGroups(five, 1, seeded(3)).every((g) => g.length === 1)).toBe(true)
  })
  it('cas limites', () => {
    expect(randomGroups([], 2)).toEqual([])
    expect(randomGroups(['seul'], 2)).toEqual([['seul']])
    expect(roomsFor(5)).toBe(2)
    expect(roomsFor(5, 1)).toBe(5)
    expect(roomsFor(0)).toBe(1)
  })
  it('minutes depuis la dernière visite', () => {
    expect(minutesSince(null, 0)).toBeNull()
    expect(minutesSince('2026-11-15T10:00:00Z', Date.parse('2026-11-15T10:07:30Z'))).toBe(7)
  })
})

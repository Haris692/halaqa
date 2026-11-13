import { describe, expect, it } from 'vitest'
import { advanceTraining, backTraining, nextMaskLevel, pickRandomVerse, startTraining } from './memorization'

describe('masquage progressif', () => {
  it('texte complet → estompé → première lettre → masqué, puis reste masqué', () => {
    expect(nextMaskLevel('full')).toBe('faded')
    expect(nextMaskLevel('faded')).toBe('first')
    expect(nextMaskLevel('first')).toBe('hidden')
    expect(nextMaskLevel('hidden')).toBe('hidden')
  })
})

describe('test « continue le verset »', () => {
  const counts = new Map([
    [112, 4],
    [113, 5],
  ])
  it('tire uniquement dans les sourates apprises', () => {
    for (let i = 0; i < 50; i++) {
      const k = pickRandomVerse([112], counts, Math.random)!
      expect(k.startsWith('112:')).toBe(true)
    }
  })
  it('chaque verset est tirable (bornes de rng)', () => {
    expect(pickRandomVerse([112, 113], counts, () => 0)).toBe('112:1')
    expect(pickRandomVerse([112, 113], counts, () => 0.9999)).toBe('113:5')
  })
  it('évite les derniers tirages quand c’est possible', () => {
    expect(pickRandomVerse([112], counts, () => 0, ['112:1', '112:2'])).toBe('112:3')
    expect(pickRandomVerse([112], counts, () => 0, ['112:1', '112:2', '112:3', '112:4'])).toBe('112:1')
  })
  it('aucune sourate apprise', () => expect(pickRandomVerse([], counts, Math.random)).toBeNull())
})

describe('mode entraînement', () => {
  it('écoute ×N → lecture → récitation (première lettre) → récitation (masqué)', () => {
    let s = startTraining(3)
    expect(s.steps.map((x) => x.kind)).toEqual(['listen', 'read', 'recite', 'recite'])
    expect(s.steps[0]).toEqual({ kind: 'listen', repeat: 3 })
    for (let i = 0; i < 3; i++) s = advanceTraining(s)
    expect(s.index).toBe(3)
    expect(s.done).toBe(false)
    s = advanceTraining(s)
    expect(s.done).toBe(true)
    expect(backTraining(s)).toMatchObject({ index: 2, done: false })
  })
})

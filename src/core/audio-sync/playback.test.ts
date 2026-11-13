import { describe, expect, it } from 'vitest'
import { afterVerseEnded, type PlaybackSettings } from './playback'

const base: PlaybackSettings = {
  rangeStart: 0,
  rangeEnd: 2,
  repeatEach: 1,
  loopRange: false,
  pauseAfterVerse: { kind: 'none' },
}

describe('afterVerseEnded', () => {
  it('passe au verset suivant', () => {
    expect(afterVerseEnded({ verseIndex: 0, playsDone: 0 }, base)).toEqual({
      next: { verseIndex: 1, playsDone: 0 },
      action: { type: 'play', verseIndex: 1 },
    })
  })

  it('répète un verset N fois', () => {
    const s = { ...base, repeatEach: 3 }
    let pos = { verseIndex: 0, playsDone: 0 }
    const played: number[] = []
    for (let i = 0; i < 4; i++) {
      const r = afterVerseEnded(pos, s)
      if (r.action.type === 'play') played.push(r.action.verseIndex)
      pos = r.next
    }
    expect(played).toEqual([0, 0, 1, 1])
  })

  it('s’arrête en fin de plage', () => {
    expect(afterVerseEnded({ verseIndex: 2, playsDone: 0 }, base).action).toEqual({ type: 'stop' })
  })

  it('boucle sur la plage', () => {
    const r = afterVerseEnded({ verseIndex: 2, playsDone: 0 }, { ...base, rangeStart: 1, loopRange: true })
    expect(r.action).toEqual({ type: 'play', verseIndex: 1 })
  })

  it('pause pour que l’élève répète', () => {
    const r = afterVerseEnded({ verseIndex: 0, playsDone: 0 }, { ...base, pauseAfterVerse: { kind: 'click' } })
    expect(r.action).toEqual({ type: 'pause-then-play', verseIndex: 1, pause: { kind: 'click' } })
  })

  it('une valeur de répétition invalide vaut 1', () => {
    expect(afterVerseEnded({ verseIndex: 0, playsDone: 0 }, { ...base, repeatEach: 0 }).next.verseIndex).toBe(1)
  })
})

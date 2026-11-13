import { useEffect, useMemo, useState } from 'react'
import type { PauseAfterVerse, PlaybackSettings } from '@/core/audio-sync/playback'
import { buildTimeline } from '@/core/audio-sync/timeline'
import { verseKey, type VerseKey } from '@/core/quran/types'
import { useSettings, type PauseChoice } from '@/features/settings/store'
import { useAsync } from '@/lib/useAsync'
import { loadRecitation } from '@/services/quran-data'
import { useRecitationPlayer } from './useRecitationPlayer'

export function toPause(choice: PauseChoice): PauseAfterVerse {
  if (choice === 'none') return { kind: 'none' }
  if (choice === 'click') return { kind: 'click' }
  return { kind: 'timed', ms: Number(choice) }
}

/**
 * Lecture d'une sourate avec le récitateur choisi : minutage, plage de versets,
 * répétitions et pauses issues des réglages. `verseCount` = nombre de versets.
 */
export function useSurahPlayback(
  surah: number | null,
  verseCount: number,
  overrides?: { repeatEach?: number; pauseAfter?: PauseChoice; range?: [number, number] },
) {
  const reciter = useSettings((s) => s.reciter)
  const speed = useSettings((s) => s.speed)
  const repeatEach = useSettings((s) => s.repeatEach)
  const pauseAfter = useSettings((s) => s.pauseAfter)

  const recitation = useAsync(
    () => (surah ? loadRecitation(reciter, surah) : Promise.resolve(null)),
    [reciter, surah],
  )
  const order = useMemo<VerseKey[]>(
    () => (surah ? Array.from({ length: verseCount }, (_, i) => verseKey(surah, i + 1)) : []),
    [surah, verseCount],
  )
  const timeline = useMemo(
    () => (recitation.status === 'ready' && recitation.value ? buildTimeline(recitation.value, order) : null),
    [recitation, order],
  )

  const [range, setRange] = useState<[number, number]>([0, Math.max(0, verseCount - 1)])
  const [loop, setLoop] = useState(false)
  useEffect(() => {
    setRange([0, Math.max(0, verseCount - 1)])
  }, [surah, verseCount])
  const effectiveRange = overrides?.range ?? range

  const settings = useMemo<PlaybackSettings>(
    () => ({
      rangeStart: effectiveRange[0],
      rangeEnd: effectiveRange[1],
      repeatEach: overrides?.repeatEach ?? repeatEach,
      loopRange: loop,
      pauseAfterVerse: toPause(overrides?.pauseAfter ?? pauseAfter),
    }),
    [effectiveRange, repeatEach, loop, pauseAfter, overrides?.repeatEach, overrides?.pauseAfter],
  )
  const { player, snapshot } = useRecitationPlayer(timeline, order, settings)
  useEffect(() => {
    player?.setSpeed(speed)
  }, [player, speed])

  return {
    player,
    snapshot,
    order,
    range: effectiveRange,
    setRange,
    loop,
    setLoop,
    loading: recitation.status === 'loading',
    error: recitation.status === 'error' ? recitation.error : null,
  }
}

export type SurahPlayback = ReturnType<typeof useSurahPlayback>

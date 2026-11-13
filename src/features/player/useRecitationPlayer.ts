import { useEffect, useState, useSyncExternalStore } from 'react'
import type { PlaybackSettings } from '@/core/audio-sync/playback'
import type { Timeline } from '@/core/audio-sync/timeline'
import type { VerseKey } from '@/core/quran/types'
import { RecitationPlayer, type PlayerSnapshot } from '@/services/audio/recitation-player'

const IDLE: PlayerSnapshot = {
  status: 'idle',
  waitingFor: null,
  verseIndex: 0,
  activeVerse: null,
  activeWord: null,
  singleWord: false,
  speed: 1,
}
const noopSubscribe = () => () => {}
const idleSnapshot = () => IDLE

export function useRecitationPlayer(
  timeline: Timeline | null,
  order: readonly VerseKey[],
  settings: PlaybackSettings,
): { player: RecitationPlayer | null; snapshot: PlayerSnapshot } {
  const [player, setPlayer] = useState<RecitationPlayer | null>(null)

  useEffect(() => {
    if (!timeline) return
    const p = new RecitationPlayer(timeline, order, settings)
    setPlayer(p)
    return () => {
      p.destroy()
      setPlayer(null)
    }
    // Un nouveau lecteur seulement quand la récitation change ; les réglages suivent ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline])

  useEffect(() => {
    player?.setSettings(settings)
  }, [player, settings])

  const snapshot = useSyncExternalStore(player?.subscribe ?? noopSubscribe, player?.getSnapshot ?? idleSnapshot)
  return { player, snapshot }
}

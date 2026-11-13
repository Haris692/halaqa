/**
 * Décide quoi faire quand un verset se termine : répéter, faire une pause pour
 * que l'élève répète, passer au suivant, boucler sur la plage ou s'arrêter.
 * Logique pure — le lecteur audio ne fait qu'exécuter l'action renvoyée.
 */

export type PauseAfterVerse = { kind: 'none' } | { kind: 'timed'; ms: number } | { kind: 'click' }

export interface PlaybackSettings {
  /** indices (dans l'ordre de lecture) du premier et du dernier verset de la plage */
  rangeStart: number
  rangeEnd: number
  /** nombre de lectures de chaque verset (1 = pas de répétition) */
  repeatEach: number
  loopRange: boolean
  pauseAfterVerse: PauseAfterVerse
}

export interface PlaybackPosition {
  verseIndex: number
  /** nombre de lectures déjà terminées pour ce verset */
  playsDone: number
}

export type PlaybackAction =
  | { type: 'play'; verseIndex: number }
  | { type: 'pause-then-play'; verseIndex: number; pause: Exclude<PauseAfterVerse, { kind: 'none' }> }
  | { type: 'stop' }

export function afterVerseEnded(
  pos: PlaybackPosition,
  settings: PlaybackSettings,
): { next: PlaybackPosition; action: PlaybackAction } {
  const playsDone = pos.playsDone + 1
  const repeatEach = Math.max(1, Math.floor(settings.repeatEach))

  let next: PlaybackPosition
  if (playsDone < repeatEach) {
    next = { verseIndex: pos.verseIndex, playsDone }
  } else if (pos.verseIndex < settings.rangeEnd) {
    next = { verseIndex: pos.verseIndex + 1, playsDone: 0 }
  } else if (settings.loopRange) {
    next = { verseIndex: settings.rangeStart, playsDone: 0 }
  } else {
    return { next: { verseIndex: pos.verseIndex, playsDone }, action: { type: 'stop' } }
  }

  const pause = settings.pauseAfterVerse
  const action: PlaybackAction =
    pause.kind === 'none'
      ? { type: 'play', verseIndex: next.verseIndex }
      : { type: 'pause-then-play', verseIndex: next.verseIndex, pause }
  return { next, action }
}

export const SPEEDS = [0.5, 0.75, 1, 1.25] as const

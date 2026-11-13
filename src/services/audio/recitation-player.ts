import { afterVerseEnded, type PlaybackPosition, type PlaybackSettings } from '@/core/audio-sync/playback'
import {
  activeVerseAt,
  activeWordAt,
  locateVerse,
  locateWord,
  type Timeline,
  type TimedWord,
} from '@/core/audio-sync/timeline'
import type { VerseKey } from '@/core/quran/types'

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'waiting'

export interface PlayerSnapshot {
  status: PlayerStatus
  /** pendant une pause de répétition : attente d'un clic ou d'un minuteur */
  waitingFor: 'click' | 'timer' | null
  verseIndex: number
  activeVerse: VerseKey | null
  activeWord: TimedWord | null
  singleWord: boolean
  speed: number
}

export interface PlayerFrame {
  /** temps courant dans la piste (ms) */
  ms: number
  word: TimedWord | null
}

/** Tolérance pour enchaîner deux versets d'une même piste sans « seek ». */
const CONTIGUOUS_MS = 80

/**
 * Lecteur de récitation : boucle requestAnimationFrame sur `currentTime`
 * (l'événement `timeupdate` est trop peu fréquent), double tampon audio pour
 * précharger le verset suivant, et application des règles de répétition/pause.
 */
export class RecitationPlayer {
  private readonly audios: [HTMLAudioElement, HTMLAudioElement]
  private cur = 0
  private trackIndex = -1
  private raf = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopAtMs: number | null = null
  private pos: PlaybackPosition = { verseIndex: 0, playsDone: 0 }
  private snapshot: PlayerSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly frameListeners = new Set<(f: PlayerFrame) => void>()

  constructor(
    private readonly timeline: Timeline,
    private readonly order: readonly VerseKey[],
    private settings: PlaybackSettings,
  ) {
    this.audios = [new Audio(), new Audio()]
    for (const a of this.audios) a.preload = 'auto'
    this.snapshot = {
      status: 'idle',
      waitingFor: null,
      verseIndex: 0,
      activeVerse: null,
      activeWord: null,
      singleWord: false,
      speed: 1,
    }
  }

  // ---------- abonnement (useSyncExternalStore) ----------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = () => this.snapshot

  /** Appelé à chaque image pendant la lecture (pour le surlignage lettre, sans re-rendu React). */
  onFrame(listener: (f: PlayerFrame) => void): () => void {
    this.frameListeners.add(listener)
    return () => this.frameListeners.delete(listener)
  }

  private set(patch: Partial<PlayerSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const l of this.listeners) l()
  }

  private get audio(): HTMLAudioElement {
    return this.audios[this.cur]!
  }

  // ---------- commandes ----------

  playFromVerse(verseIndex: number): void {
    this.pos = { verseIndex, playsDone: 0 }
    this.startVerse(verseIndex)
  }

  play(): void {
    if (this.snapshot.status === 'waiting') return this.continueAfterWait()
    if (this.snapshot.status === 'paused' && !this.snapshot.singleWord && this.trackIndex >= 0) {
      this.resumeAudio()
      return
    }
    this.playFromVerse(this.settings.rangeStart)
  }

  pause(): void {
    clearTimeout(this.timer)
    this.audio.pause()
    cancelAnimationFrame(this.raf)
    this.set({ status: 'paused', waitingFor: null })
  }

  continueAfterWait(): void {
    clearTimeout(this.timer)
    this.startVerse(this.pos.verseIndex)
  }

  /** Toucher un mot = l'écouter seul. */
  playWord(verse: VerseKey, position: number): void {
    const loc = locateWord(this.timeline, verse, position)
    if (!loc) return
    clearTimeout(this.timer)
    this.useTrack(loc.trackIndex)
    this.stopAtMs = loc.word.end
    this.seekAndPlay(loc.word.start, true)
  }

  setSpeed(speed: number): void {
    for (const a of this.audios) a.playbackRate = speed
    this.set({ speed })
  }

  setSettings(settings: PlaybackSettings): void {
    this.settings = settings
  }

  destroy(): void {
    clearTimeout(this.timer)
    cancelAnimationFrame(this.raf)
    for (const a of this.audios) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
    this.listeners.clear()
    this.frameListeners.clear()
  }

  // ---------- interne ----------

  private startVerse(verseIndex: number): void {
    const key = this.order[verseIndex]
    const loc = key ? locateVerse(this.timeline, key) : null
    if (!loc) return this.set({ status: 'idle' })
    this.useTrack(loc.trackIndex)
    this.stopAtMs = null
    this.set({ verseIndex })
    this.seekAndPlay(loc.verse.from, false)
    this.preloadAfter(verseIndex)
  }

  private useTrack(trackIndex: number): void {
    if (trackIndex === this.trackIndex) return
    const track = this.timeline.tracks[trackIndex]!
    const other = this.audios[1 - this.cur]!
    this.audio.pause()
    if (other.src.endsWith(track.src)) {
      this.cur = 1 - this.cur // le verset suivant était déjà préchargé
    } else {
      this.audio.src = track.src
    }
    this.audio.playbackRate = this.snapshot.speed
    this.trackIndex = trackIndex
  }

  private preloadAfter(verseIndex: number): void {
    const nextKey = this.order[verseIndex + 1] ?? this.order[this.settings.rangeStart]
    const loc = nextKey ? locateVerse(this.timeline, nextKey) : null
    if (!loc || loc.trackIndex === this.trackIndex) return
    const other = this.audios[1 - this.cur]!
    const src = this.timeline.tracks[loc.trackIndex]!.src
    if (!other.src.endsWith(src)) {
      other.src = src
      other.load()
    }
  }

  private seekAndPlay(ms: number, singleWord: boolean): void {
    const audio = this.audio
    const start = () => {
      audio.currentTime = ms / 1000
      this.resumeAudio(singleWord)
    }
    if (audio.readyState >= 1) start()
    else audio.addEventListener('loadedmetadata', start, { once: true })
  }

  private resumeAudio(singleWord = this.snapshot.singleWord): void {
    this.audio.play().then(
      () => {
        this.set({ status: 'playing', waitingFor: null, singleWord })
        cancelAnimationFrame(this.raf)
        this.raf = requestAnimationFrame(this.tick)
      },
      () => this.set({ status: 'paused', waitingFor: null }),
    )
  }

  private readonly tick = () => {
    const track = this.timeline.tracks[this.trackIndex]
    if (!track) return
    const audio = this.audio
    const ms = audio.currentTime * 1000
    const word = activeWordAt(track, ms)
    const verse = activeVerseAt(track, ms)

    for (const l of this.frameListeners) l({ ms, word })
    const prev = this.snapshot.activeWord
    if (prev?.verse !== word?.verse || prev?.position !== word?.position || this.snapshot.activeVerse !== (verse?.key ?? null)) {
      this.set({ activeWord: word, activeVerse: verse?.key ?? null })
    }

    if (this.stopAtMs !== null) {
      if (ms >= this.stopAtMs || audio.ended) {
        this.stopAtMs = null
        this.pause()
        return
      }
    } else {
      const key = this.order[this.pos.verseIndex]
      const current = key ? track.verses.find((v) => v.key === key) : undefined
      if (!current || ms >= current.to || audio.ended) return this.onVerseEnded(current?.to ?? ms)
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private onVerseEnded(endedAtMs: number): void {
    const { next, action } = afterVerseEnded(this.pos, this.settings)
    this.pos = next

    if (action.type === 'stop') {
      this.audio.pause()
      this.set({ status: 'idle', waitingFor: null, activeWord: null, activeVerse: null })
      return
    }
    if (action.type === 'pause-then-play') {
      this.audio.pause()
      if (action.pause.kind === 'timed') {
        this.set({ status: 'waiting', waitingFor: 'timer', activeWord: null })
        this.timer = setTimeout(() => this.startVerse(action.verseIndex), action.pause.ms)
      } else {
        this.set({ status: 'waiting', waitingFor: 'click', activeWord: null })
      }
      return
    }

    // Lecture continue : dans une sourate « gapless », si le verset suivant suit
    // immédiatement, on laisse l'audio filer sans seek (aucun blanc, aucun clic).
    const nextKey = this.order[action.verseIndex]
    const loc = nextKey ? locateVerse(this.timeline, nextKey) : null
    if (loc && loc.trackIndex === this.trackIndex && Math.abs(loc.verse.from - endedAtMs) < CONTIGUOUS_MS && !this.audio.ended) {
      this.set({ verseIndex: action.verseIndex })
      this.preloadAfter(action.verseIndex)
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    this.startVerse(action.verseIndex)
  }
}

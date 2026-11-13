import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MaskLevel } from '@/core/memorization/memorization'
import type { TajweedFamily } from '@/core/tajweed/rules'
import type { VerseKey } from '@/core/quran/types'

export type Theme = 'light' | 'dark' | 'contrast'
export type ReaderMode = 'reading' | 'mushaf'
export type HighlightLevel = 'verse' | 'word' | 'letter'
export type PauseChoice = 'none' | '2000' | '4000' | '8000' | 'click'

export interface ReaderSettings {
  theme: Theme
  mode: ReaderMode
  fontSize: number
  reciter: string
  highlight: HighlightLevel
  speed: number
  repeatEach: number
  pauseAfter: PauseChoice
  autoScroll: boolean
  tajweed: boolean
  /** null = toutes les règles ; sinon seulement la famille de « la règle de la semaine » */
  tajweedOnly: TajweedFamily | null
  translation: string
  tafsir: string
  panelOpen: boolean
  panelTab: 'translation' | 'tafsir'
  mask: MaskLevel
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  mode: 'reading',
  fontSize: 40,
  reciter: 'husary-muallim',
  highlight: 'word',
  speed: 1,
  repeatEach: 1,
  pauseAfter: 'none',
  autoScroll: true,
  tajweed: false,
  tajweedOnly: null,
  translation: 'french_hameedullah',
  tafsir: 'french_mokhtasar',
  panelOpen: false,
  panelTab: 'translation',
  mask: 'full',
}

export const FONT_MIN = 24
export const FONT_MAX = 96

interface SettingsStore extends ReaderSettings {
  set: (patch: Partial<ReaderSettings>) => void
  reset: () => void
}

/** Réglages du lecteur, conservés sur l'appareil (pas besoin de compte). */
export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      // Les actions ne renvoient rien : avec `persist`, set() renvoie une promesse,
      // qui ne doit jamais remonter (ex. dans un useEffect, elle serait prise pour un nettoyage).
      set: (patch) => {
        set(
          patch.fontSize === undefined
            ? patch
            : { ...patch, fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(patch.fontSize))) },
        )
      },
      reset: () => {
        set(DEFAULT_SETTINGS)
      },
    }),
    { name: 'halaqa.settings', version: 1 },
  ),
)

interface ProgressStore {
  /** dernière position de lecture */
  last: VerseKey | null
  /** sourates apprises (pour le test « continue le verset ») */
  learned: number[]
  setLast: (key: VerseKey) => void
  toggleLearned: (surah: number) => void
  setLearned: (surahs: number[]) => void
}

export const useProgress = create<ProgressStore>()(
  persist(
    (set) => ({
      last: null,
      learned: [],
      setLast: (last) => {
        set({ last })
      },
      toggleLearned: (surah) => {
        set((s) => ({
          learned: s.learned.includes(surah) ? s.learned.filter((x) => x !== surah) : [...s.learned, surah].sort((a, b) => a - b),
        }))
      },
      setLearned: (learned) => {
        set({ learned: [...new Set(learned)].sort((a, b) => a - b) })
      },
    }),
    { name: 'halaqa.progress', version: 1 },
  ),
)

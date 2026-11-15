import { create } from 'zustand'
import { useAuth } from '@/features/auth/store'
import { fetchState, joinSession, subscribeSession, updateMe, type LiveParticipant, type LiveState } from '@/services/live'

/**
 * Séance en cours côté navigateur : état diffusé par Supabase Realtime, indépendant
 * des pages. La visio (LiveKit) est gérée par le panneau de séance, chargé à la demande.
 * Ce module ne dépend pas de LiveKit : le lecteur peut l'importer sans s'alourdir.
 */

interface LiveStore {
  sessionId: string | null
  state: LiveState | null
  error: string | null
  /** choix d'entrée : micro, caméra, audio seul (connexions faibles) */
  prefs: { mic: boolean; camera: boolean; audioOnly: boolean }
  dockOpen: boolean
  dashboardOpen: boolean
  join: (sessionId: string) => Promise<void>
  leave: () => void
  refresh: () => Promise<void>
  setPrefs: (p: Partial<LiveStore['prefs']>) => void
  setDockOpen: (open: boolean) => void
  setDashboardOpen: (open: boolean) => void
}

const STORAGE_KEY = 'halaqa.live'
let unsubscribe: (() => void) | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null

export const useLive = create<LiveStore>()((set, get) => ({
  sessionId: null,
  state: null,
  error: null,
  prefs: { mic: true, camera: false, audioOnly: false },
  dockOpen: false,
  dashboardOpen: false,

  join: async (sessionId) => {
    if (get().sessionId === sessionId && get().state) return
    get().leave()
    // sur téléphone, le panneau démarre replié pour laisser le Coran visible
    set({ sessionId, error: null, dockOpen: window.matchMedia('(min-width: 1024px)').matches })
    try {
      await joinSession(sessionId)
      sessionStorage.setItem(STORAGE_KEY, sessionId)
      unsubscribe = subscribeSession(sessionId, () => {
        void get().refresh()
      })
      await get().refresh()
      // signe de vie : le tableau de bord du prof repère les élèves déconnectés
      heartbeat = setInterval(() => {
        const me = useAuth.getState().profile?.id
        if (me && get().sessionId) void updateMe(sessionId, me, { last_seen_at: new Date().toISOString() }).catch(() => undefined)
      }, 30_000)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) })
    }
  },

  leave: () => {
    unsubscribe?.()
    unsubscribe = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    sessionStorage.removeItem(STORAGE_KEY)
    set({ sessionId: null, state: null, error: null, dashboardOpen: false })
  },

  refresh: async () => {
    const id = get().sessionId
    if (!id) return
    try {
      const state = await fetchState(id)
      if (get().sessionId !== id) return
      set({ state, error: null })
      if (state.session.status === 'ended') get().leave()
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) })
    }
  },

  setPrefs: (p) => {
    set({ prefs: { ...get().prefs, ...p } })
  },
  setDockOpen: (dockOpen) => {
    set({ dockOpen })
  },
  setDashboardOpen: (dashboardOpen) => {
    set({ dashboardOpen })
  },
}))

/** Après un rechargement de page, on revient dans la séance où l'on était. */
export function resumeLiveSession() {
  const id = sessionStorage.getItem(STORAGE_KEY)
  if (id) void useLive.getState().join(id)
}

export function myParticipant(state: LiveState | null, userId: string | undefined): LiveParticipant | undefined {
  return state?.participants.find((p) => p.user_id === userId)
}

/** Verset surligné par le prof chez tout le monde (talqîn), ou null. */
export function useFocusVerse(): string | null {
  return useLive((s) => s.state?.session.focus_verse ?? null)
}

/** Le lecteur signale le verset où se trouve l'élève (vu par le prof sur le tableau de bord). */
let lastReported: string | null = null
export function reportVerse(verse: string) {
  const { sessionId } = useLive.getState()
  const me = useAuth.getState().profile?.id
  if (!sessionId || !me || verse === lastReported) return
  lastReported = verse
  void updateMe(sessionId, me, { current_verse: verse }).catch(() => undefined)
}

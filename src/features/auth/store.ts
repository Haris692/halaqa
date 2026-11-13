import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { clearQueries } from '@/lib/query'
import { supabase, type Profile } from '@/services/supabase'

export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn'

interface AuthStore {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  /** arrivée par un lien « mot de passe oublié » : proposer un nouveau mot de passe */
  recovery: boolean
  refreshProfile: () => Promise<void>
  clearRecovery: () => void
}

export const useAuth = create<AuthStore>()((set, get) => ({
  status: supabase ? 'loading' : 'disabled',
  session: null,
  profile: null,
  recovery: false,
  refreshProfile: async () => {
    const { session } = get()
    if (!supabase || !session) return
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    set({ profile: data, status: 'signedIn' })
  },
  clearRecovery: () => {
    set({ recovery: false })
  },
}))

let started = false

/** Démarre l'écoute de la session (une fois, au lancement de l'application). */
export function startAuth() {
  if (!supabase || started) return
  started = true
  supabase.auth.onAuthStateChange((event, session) => {
    const previous = useAuth.getState().session?.user.id
    if (event === 'PASSWORD_RECOVERY') useAuth.setState({ recovery: true })
    if (!session) {
      clearQueries()
      useAuth.setState({ status: 'signedOut', session: null, profile: null })
      return
    }
    if (previous && previous !== session.user.id) clearQueries()
    const known = useAuth.getState().profile?.id === session.user.id
    useAuth.setState({ session, status: known ? 'signedIn' : 'loading' })
    // Pas d'appel Supabase directement dans ce rappel (verrou interne d'auth-js).
    setTimeout(() => {
      void useAuth.getState().refreshProfile()
    }, 0)
  })
}

export const isStaff = (p: Profile | null) => p?.role === 'teacher' || p?.role === 'admin'

import { useEffect, useSyncExternalStore } from 'react'
import type { AsyncState } from './useAsync'

/**
 * Petit cache de requêtes partagé entre composants (sans dépendance) :
 * une clé = une promesse ; `invalidate(préfixe)` recharge les vues concernées
 * après une modification.
 */
type Entry = { state: AsyncState<unknown>; promise: Promise<unknown> | null; version: number; stale?: boolean }

const cache = new Map<string, Entry>()
const listeners = new Set<() => void>()
let tick = 0

function emit() {
  tick++
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function load<T>(key: string, fn: () => Promise<T>) {
  const previous = cache.get(key)
  const version = (previous?.version ?? 0) + 1
  const entry: Entry = {
    // garder l'ancienne valeur pendant le rechargement évite un clignotement
    state: previous?.state.status === 'ready' ? previous.state : { status: 'loading' },
    promise: null,
    version,
  }
  entry.promise = fn().then(
    (value) => {
      if (cache.get(key)?.version === version) cache.set(key, { ...entry, state: { status: 'ready', value }, promise: null })
      emit()
    },
    (error: unknown) => {
      if (cache.get(key)?.version === version)
        cache.set(key, { ...entry, state: { status: 'error', error: error instanceof Error ? error : new Error(String(error)) }, promise: null })
      emit()
    },
  )
  cache.set(key, entry)
}

/** `key` null = requête désactivée (ex. utilisateur non connecté). */
export function useQuery<T>(key: string | null, fn: () => Promise<T>): AsyncState<T> & { reload: () => void } {
  const version = useSyncExternalStore(subscribe, () => tick)
  // (re)charge si la clé est absente du cache ou périmée (après invalidate())
  useEffect(() => {
    const entry = key ? cache.get(key) : undefined
    if (key && (!entry || entry.stale)) {
      load(key, fn)
      emit()
    }
    // fn change à chaque rendu : seules la clé et les invalidations comptent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])
  const entry = key ? cache.get(key) : undefined
  const state = (entry?.state ?? { status: 'loading' }) as AsyncState<T>
  return {
    ...state,
    reload: () => {
      if (key) {
        load(key, fn)
        emit()
      }
    },
  }
}

/**
 * Marque périmées les requêtes dont la clé commence par `prefix` : elles se
 * rechargent à la prochaine lecture, en gardant l'ancienne valeur affichée d'ici là.
 */
export function invalidate(prefix: string) {
  for (const [k, entry] of cache) if (k.startsWith(prefix)) cache.set(k, { ...entry, stale: true })
  emit()
}

export function clearQueries() {
  cache.clear()
  emit()
}

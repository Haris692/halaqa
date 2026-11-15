import type { LiveMessage } from '@/core/live/tools'

/**
 * Relais des messages de la salle (canaux data LiveKit). Le panneau de séance, seul
 * à charger LiveKit, y branche sa connexion ; le lecteur publie et écoute ici sans
 * dépendre de LiveKit.
 */

export interface RoomLink {
  /** identité LiveKit = identifiant du profil */
  identity: string
  send: (data: Uint8Array<ArrayBuffer>) => Promise<void>
}

type Handler = (msg: LiveMessage, from: string) => void

const TOPIC = 'halaqa'
const encoder = new TextEncoder()
const decoder = new TextDecoder()
let link: RoomLink | null = null
const handlers = new Set<Handler>()
const joinHandlers = new Set<() => void>()

export const BUS_TOPIC = TOPIC

export function attachRoom(next: RoomLink | null) {
  link = next
}

export function isAttached() {
  return link !== null
}

export function publish(msg: LiveMessage) {
  if (!link) return
  void link.send(encoder.encode(JSON.stringify(msg))).catch(() => undefined)
}

/** Appelé par le panneau pour chaque message reçu (`from` = identité LiveKit de l'envoyeur). */
export function deliver(payload: Uint8Array, from: string | undefined, topic: string | undefined) {
  if (topic !== TOPIC || !from) return
  let msg: LiveMessage
  try {
    msg = JSON.parse(decoder.decode(payload)) as LiveMessage
  } catch {
    return
  }
  if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return
  for (const h of handlers) h(msg, from)
}

export function onMessage(h: Handler): () => void {
  handlers.add(h)
  return () => handlers.delete(h)
}

/** Quelqu'un arrive dans la salle (ou on vient de s'y connecter) : chacun renvoie sa vue. */
export function announceJoin() {
  for (const h of joinHandlers) h()
}

export function onJoin(h: () => void): () => void {
  joinHandlers.add(h)
  return () => joinHandlers.delete(h)
}

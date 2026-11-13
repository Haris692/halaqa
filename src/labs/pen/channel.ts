import { useEffect, useRef, useState } from 'react'
import type { AnnotationMessage } from '@/core/annotations/protocol'
import { byteLength } from '@/core/annotations/strokes'

/**
 * Canal du labo : BroadcastChannel entre onglets du même navigateur. Il a la
 * même forme que ce que fera un canal data LiveKit (messages JSON, taille
 * mesurée), pour que le passage en phase 4 ne change que ce fichier.
 */
export type LabMessage = AnnotationMessage | { t: 'perm'; studentPen: boolean }

interface Envelope {
  m: LabMessage
  sentAt: number
}

export interface ChannelStats {
  sent: number
  received: number
  maxBytes: number
  lastLatencyMs: number | null
}

export function useLabChannel(onMessage: (m: LabMessage) => void) {
  const handler = useRef(onMessage)
  handler.current = onMessage
  const channelRef = useRef<BroadcastChannel | null>(null)
  const [stats, setStats] = useState<ChannelStats>({ sent: 0, received: 0, maxBytes: 0, lastLatencyMs: null })

  useEffect(() => {
    const channel = new BroadcastChannel('halaqa-lab-crayon')
    channelRef.current = channel
    channel.onmessage = (e: MessageEvent<string>) => {
      const env = JSON.parse(e.data) as Envelope
      setStats((s) => ({ ...s, received: s.received + 1, lastLatencyMs: Date.now() - env.sentAt }))
      handler.current(env.m)
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [])

  const send = useRef((m: LabMessage) => {
    const data = JSON.stringify({ m, sentAt: Date.now() } satisfies Envelope)
    channelRef.current?.postMessage(data)
    // L'état complet (sync-state) passera par Supabase, pas par LiveKit : on ne
    // mesure que les messages « en direct ».
    const bytes = m.t === 'sync-state' ? 0 : byteLength(data)
    setStats((s) => ({ ...s, sent: s.sent + 1, maxBytes: Math.max(s.maxBytes, bytes) }))
  }).current

  return { send, stats }
}

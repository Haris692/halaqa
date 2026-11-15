import { useEffect, useRef } from 'react'
import { followTarget, sameView, type ViewState } from '@/core/live/tools'
import { parseVerseKey, type VerseKey } from '@/core/quran/types'
import type { RecitationPlayer } from '@/services/audio/recitation-player'
import { onJoin, onMessage, publish } from './bus'
import { useBoard } from './board'
import { useRoomInfo } from './room'

/**
 * Vue partagée : le lecteur envoie dans la salle où il en est (verset, page, lecture),
 * et suit la vue du prof qui a « pris la main » — ou, pour le prof, celle de l'élève
 * qu'il a choisi. Chaque appareil garde son propre mode (lecture ou Mushaf) et son zoom.
 */
export function useViewSync(opts: {
  view: Omit<ViewState, 'at'>
  /** aller à la vue suivie (changer de sourate ou de page, faire défiler) */
  goTo: (target: ViewState) => void
  player: RecitationPlayer | null
  /** sourate jouée par le lecteur de cette page (pour suivre la lecture audio du prof) */
  playerSurah: number
}) {
  const info = useRoomInfo()
  const inRoom = !!info
  const viewRef = useRef(opts.view)
  viewRef.current = opts.view
  const lastSent = useRef<ViewState | null>(null)

  // ---- envoyer ma vue (regroupé : au plus une fois toutes les 300 ms)
  const { mode, verse, page, playing } = opts.view
  useEffect(() => {
    if (!inRoom) return
    const id = setTimeout(() => {
      const next: ViewState = { ...viewRef.current, at: Date.now() }
      if (sameView(lastSent.current, next)) return
      lastSent.current = next
      publish({ t: 'view', view: next })
    }, 300)
    return () => clearTimeout(id)
  }, [inRoom, mode, verse, page, playing])

  // à l'arrivée de quelqu'un (ou sur demande) : on renvoie sa vue
  useEffect(() => {
    if (!inRoom) return
    const resend = () => {
      const next: ViewState = { ...viewRef.current, at: Date.now() }
      lastSent.current = next
      publish({ t: 'view', view: next })
    }
    const offJoin = onJoin(resend)
    const offMsg = onMessage((m) => m.t === 'view-request' && resend())
    publish({ t: 'view-request' })
    resend()
    return () => {
      offJoin()
      offMsg()
    }
  }, [inRoom, info?.room.id])

  // ---- suivre
  const followChoice = useBoard((s) => s.followChoice)
  const target = info ? followTarget({ me: info.me, isTeacher: info.isTeacher, leaderId: info.leaderId, chosen: followChoice }) : null
  const targetView = useBoard((s) => (target ? s.views[target] : undefined))
  const followsLeader = !!info && target === info.leaderId
  const applied = useRef<ViewState | null>(null)
  const goToRef = useRef(opts.goTo)
  goToRef.current = opts.goTo
  useEffect(() => {
    if (!targetView) return
    if (applied.current && sameView(applied.current, targetView)) return
    const moved = !applied.current || applied.current.verse !== targetView.verse || applied.current.page !== targetView.page
    applied.current = targetView
    if (moved) goToRef.current(targetView)
  }, [targetView])
  useEffect(() => {
    applied.current = null
  }, [target])

  // ---- lecture audio pilotée par le prof (chaque élève l'entend sur son appareil)
  const startedByLeader = useRef(false)
  const player = opts.player
  useEffect(() => {
    if (!followsLeader || !player || !targetView) return
    const snap = player.getSnapshot?.()
    if (targetView.playing) {
      const { surah, verse: n } = parseVerseKey(targetView.playing)
      if (surah !== opts.playerSurah) return
      const mine = snap?.activeVerse ? parseVerseKey(snap.activeVerse as VerseKey).verse : null
      if (snap?.status !== 'playing' || mine === null || Math.abs(mine - n) > 1) {
        player.playFromVerse(n - 1)
        startedByLeader.current = true
      }
    } else if (startedByLeader.current) {
      startedByLeader.current = false
      player.pause()
    }
  }, [followsLeader, player, targetView, opts.playerSurah])
}

/** Premier verset visible en mode lecture (sous la barre du lecteur et celle des outils). */
export function readTopVerse(offset = 120): VerseKey | null {
  const els = document.querySelectorAll<HTMLElement>('main [data-verse]')
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.bottom > offset + 4) return el.dataset.verse as VerseKey
  }
  return null
}

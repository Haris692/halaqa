import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/store'
import { useBoard } from './board'

/**
 * Révision après la séance : `?bilan=<séance>&titre=…` (et `&eleve=<id>` pour le prof)
 * affiche sur le texte les corrections et annotations reçues pendant la séance.
 */
export function useReviewParam() {
  const [params, setParams] = useSearchParams()
  const sessionId = params.get('bilan')
  const student = params.get('eleve')
  const title = params.get('titre') ?? ''
  const me = useAuth((s) => s.profile?.id)
  const review = useBoard((s) => s.review)

  useEffect(() => {
    const target = student ?? me
    if (!sessionId || !target) return
    const current = useBoard.getState().review
    if (current?.sessionId === sessionId && current.studentId === target) return
    void useBoard.getState().loadReview(sessionId, target, title)
  }, [sessionId, student, me, title])

  // « Quitter la révision » : on retire les paramètres de l'adresse
  useEffect(() => {
    if (sessionId && review === null && useBoard.getState().roomId === null) {
      const id = setTimeout(() => {
        if (useBoard.getState().review) return
        const next = new URLSearchParams(params)
        next.delete('bilan')
        next.delete('eleve')
        next.delete('titre')
        setParams(next, { replace: true })
      }, 0)
      return () => clearTimeout(id)
    }
  }, [review, sessionId, params, setParams])
}

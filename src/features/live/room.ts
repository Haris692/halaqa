import { useMemo } from 'react'
import { parseQuiz, type Quiz } from '@/core/live/tools'
import { useAuth } from '@/features/auth/store'
import type { LiveParticipant, LiveRoom } from '@/services/live'
import { useLive } from './store'

export interface RoomInfo {
  sessionId: string
  room: LiveRoom
  me: string
  teacherId: string
  isTeacher: boolean
  /** élèves présents dans la salle (sans le prof) */
  students: LiveParticipant[]
  canDraw: boolean
  leaderId: string | null
  quiz: Quiz | null
}

/** La salle où l'on se trouve pendant une séance, ou null hors séance. */
export function useRoomInfo(): RoomInfo | null {
  const state = useLive((s) => s.state)
  const sessionId = useLive((s) => s.sessionId)
  const me = useAuth((s) => s.profile?.id)
  return useMemo(() => {
    if (!state || !sessionId || !me || state.session.status !== 'live') return null
    const mine = state.participants.find((p) => p.user_id === me)
    const room = state.rooms.find((r) => r.id === mine?.room_id)
    if (!room) return null
    const teacherId = state.session.teacher_id
    const isTeacher = teacherId === me
    return {
      sessionId,
      room,
      me,
      teacherId,
      isTeacher,
      students: state.participants.filter((p) => p.room_id === room.id && !p.is_teacher),
      canDraw: isTeacher || room.student_pen,
      leaderId: room.leader_id,
      quiz: parseQuiz(room.quiz),
    }
  }, [state, sessionId, me])
}

export const displayName = (info: RoomInfo | null, userId: string | null | undefined): string => {
  if (!info || !userId) return ''
  return useLive.getState().state?.participants.find((p) => p.user_id === userId)?.display_name ?? ''
}

// Jeton LiveKit pour la salle où se trouve l'appelant.
// C'est la base qui décide de la salle (live_participants.room_id) : le navigateur ne choisit pas.
// Pendant le talqîn, seuls le prof et l'élève qui a la parole peuvent publier en salle principale.
import { AccessToken } from 'npm:livekit-server-sdk@2.19.3'
import { caller, handle, HttpError, json, livekitConfig, roomName, sessionState } from '../_shared/livekit.ts'

Deno.serve(
  handle(async (req) => {
    const { session_id } = (await req.json()) as { session_id?: string }
    if (!session_id) throw new HttpError(400, 'session_id manquant')
    const { supabase, user } = await caller(req)
    const state = await sessionState(supabase, session_id)
    if (state.session.status !== 'live') throw new HttpError(409, 'seance_fermee')

    const me = state.participants.find((p) => p.user_id === user.id)
    if (!me?.room_id) throw new HttpError(409, 'pas_dans_une_salle')
    const room = state.rooms.find((r) => r.id === me.room_id)
    if (!room) throw new HttpError(409, 'salle_fermee')

    const teacher = state.session.teacher_id === user.id
    const silenced = !teacher && room.kind === 'main' && state.session.floor_user !== null && state.session.floor_user !== user.id
    const { apiKey, apiSecret, wsUrl } = livekitConfig()
    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: me.display_name,
      metadata: JSON.stringify({ teacher }),
      ttl: '4h',
    })
    token.addGrant({
      room: roomName(session_id, room.id),
      roomJoin: true,
      canSubscribe: true,
      canPublish: !silenced,
      canPublishData: true,
    })
    return json({ token: await token.toJwt(), url: wsUrl, room_id: room.id, room_name: room.name })
  }),
)

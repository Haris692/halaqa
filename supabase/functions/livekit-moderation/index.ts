// Talqîn : applique côté serveur LiveKit la parole donnée par le prof.
// Un client LiveKit ne peut pas couper le micro d'un autre : on retire le droit de
// publier à tous les élèves de la salle principale sauf celui qui a la parole
// (ses pistes sont dépubliées par le serveur), puis on le rend quand la parole est libérée.
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.3'
import { caller, handle, HttpError, json, livekitConfig, roomName, sessionState } from '../_shared/livekit.ts'

Deno.serve(
  handle(async (req) => {
    const { session_id } = (await req.json()) as { session_id?: string }
    if (!session_id) throw new HttpError(400, 'session_id manquant')
    const { supabase, user } = await caller(req)
    const state = await sessionState(supabase, session_id)
    if (state.session.teacher_id !== user.id) throw new HttpError(403, 'acces_refuse')

    const main = state.rooms.find((r) => r.kind === 'main')
    if (!main) return json({ updated: 0 })
    const { apiKey, apiSecret, apiUrl } = livekitConfig()
    const service = new RoomServiceClient(apiUrl, apiKey, apiSecret)
    const name = roomName(session_id, main.id)
    const floor = state.session.floor_user

    let participants: Awaited<ReturnType<RoomServiceClient['listParticipants']>> = []
    try {
      participants = await service.listParticipants(name)
    } catch {
      return json({ updated: 0 }) // salle LiveKit pas encore créée : rien à faire
    }
    let updated = 0
    for (const p of participants) {
      if (p.identity === state.session.teacher_id) continue
      const canPublish = floor === null || p.identity === floor
      if (p.permission?.canPublish === canPublish) continue
      await service.updateParticipant(name, p.identity, {
        permission: { canPublish, canSubscribe: true, canPublishData: true },
      })
      updated++
    }
    return json({ updated })
  }),
)

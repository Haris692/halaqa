// Outils communs aux fonctions LiveKit : configuration, client Supabase de l'appelant,
// état de séance vérifié par la base (les droits sont ceux de l'utilisateur : RLS + session_state).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export function livekitConfig() {
  const apiKey = Deno.env.get('LIVEKIT_API_KEY')
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
  // adresse vue par ce serveur (API) et adresse donnée aux navigateurs (WebSocket)
  const apiUrl = Deno.env.get('LIVEKIT_URL')
  const wsUrl = Deno.env.get('LIVEKIT_WS_URL') ?? apiUrl
  if (!apiKey || !apiSecret || !apiUrl || !wsUrl) throw new Error('LiveKit non configuré')
  return { apiKey, apiSecret, apiUrl: apiUrl.replace(/^ws/, 'http'), wsUrl }
}

export const roomName = (sessionId: string, roomId: string) => `halaqa-${sessionId}-${roomId}`

export interface SessionState {
  session: { id: string; status: string; teacher_id: string; floor_user: string | null; class_name: string }
  rooms: { id: string; kind: 'main' | 'breakout'; name: string }[]
  participants: { user_id: string; room_id: string | null; display_name: string; is_teacher: boolean }[]
}

/** Client Supabase agissant au nom de l'appelant, et son identité vérifiée. */
export async function caller(req: Request) {
  const authorization = req.headers.get('Authorization')
  if (!authorization) throw new HttpError(401, 'non_connecte')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data, error } = await supabase.auth.getUser(authorization.replace(/^Bearer /, ''))
  if (error || !data.user) throw new HttpError(401, 'non_connecte')
  return { supabase, user: data.user }
}

/** État de la séance ; la base refuse si l'appelant n'en fait pas partie. */
export async function sessionState(supabase: ReturnType<typeof createClient>, sessionId: string): Promise<SessionState> {
  const { data, error } = await supabase.rpc('session_state', { session_id: sessionId })
  if (error || !data) throw new HttpError(403, 'acces_refuse')
  return data as SessionState
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: e instanceof Error ? e.message : 'erreur' }, 500)
    }
  }
}

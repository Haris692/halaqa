import type { TFunction } from 'i18next'

/** Message d'erreur lisible en français pour les erreurs Supabase (auth et RPC). */
export function errorMessage(t: TFunction, error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number } | null
  const msg = e?.message ?? String(error)
  const code = e?.code ?? ''
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return t('account:errors.credentials')
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return t('account:errors.exists')
  if (code === 'weak_password' || /password should be/i.test(msg)) return t('account:errors.weakPassword')
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e?.status === 429) return t('account:errors.rateLimit')
  if (code === 'email_address_invalid' || /email address .* is invalid/i.test(msg)) return t('account:errors.email')
  // Le déclencheur d'inscription refuse les codes invalides : auth renvoie alors une erreur générique.
  if (/invitation_invalide|database error saving new user/i.test(msg)) return t('account:errors.invite')
  if (/reserve_aux_eleves/.test(msg)) return t('account:errors.studentsOnly')
  if (/seance_fermee/.test(msg)) return t('account:errors.sessionClosed')
  if (/salle_pleine/.test(msg)) return t('account:errors.roomFull')
  if (/salles_assignees/.test(msg)) return t('account:errors.roomsAssigned')
  if (/salle_inconnue|salle_fermee|pas_dans_une_salle/.test(msg)) return t('account:errors.roomGone')
  if (/LiveKit non configuré/.test(msg)) return t('account:errors.videoNotConfigured')
  if (/FunctionsFetchError|Failed to send a request to the Edge Function/i.test(msg)) return t('account:errors.video')
  if (/acces_refuse|permission denied|row-level security/i.test(msg)) return t('account:errors.forbidden')
  if (/failed to fetch|network/i.test(msg)) return t('account:errors.network')
  return t('account:errors.generic', { message: msg })
}

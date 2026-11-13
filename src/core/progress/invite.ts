/** Codes d'invitation : 10 caractères, alphabet sans 0/O, 1/I/L (voir gen_invite_code en SQL). */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE = new RegExp(`^[${INVITE_ALPHABET}]{10}$`)

/**
 * Extrait un code d'un texte collé : code seul (espaces et casse tolérés)
 * ou lien d'invitation complet (…/rejoindre/CODE).
 */
export function parseInviteInput(input: string): string | null {
  const text = input.trim()
  const fromLink = /\/rejoindre\/([A-Za-z0-9-]+)/.exec(text)?.[1]
  const raw = (fromLink ?? text).replace(/[\s-]/g, '').toUpperCase()
  return CODE.test(raw) ? raw : null
}

/** Affichage lisible : ABCDE-FGHJK. */
export function formatInviteCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code
}

/** Lien d'invitation absolu, à partir de l'origine et du chemin de base de l'application. */
export function inviteLink(origin: string, base: string, code: string): string {
  return `${origin}${base.replace(/\/$/, '')}/rejoindre/${code}`
}

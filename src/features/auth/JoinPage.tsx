import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatInviteCode, parseInviteInput } from '@/core/progress/invite'
import { Field, inputClass, Notice, PageShell } from '@/features/ui/PageShell'
import { useAsync } from '@/lib/useAsync'
import { checkInvite, joinClass, signUp } from '@/services/accounts'
import { errorMessage } from './errors'
import { isStaff, useAuth } from './store'

export const MIN_PASSWORD = 8

/**
 * Page d'invitation (`/rejoindre/CODE`) : création du compte, ou, si l'on est
 * déjà connecté en tant qu'élève, ajout à la classe.
 */
export function JoinPage() {
  const { t } = useTranslation('account')
  const { code: param } = useParams()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const code = param ? parseInviteInput(param) : null
  const status = useAuth((s) => s.status)

  if (status === 'disabled') {
    return (
      <PageShell title={t('join.title')}>
        <Notice>{t('disabled')}</Notice>
      </PageShell>
    )
  }

  if (!code) {
    const parsed = parseInviteInput(typed)
    return (
      <PageShell title={t('join.title')}>
        {param && <Notice tone="error">{t('errors.invite')}</Notice>}
        <Card>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (parsed) navigate(`/rejoindre/${parsed}`)
              }}
            >
              <Field label={t('join.codeLabel')} htmlFor="code" hint={t('join.codeHint')}>
                <Input id="code" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" className={inputClass} />
              </Field>
              <Button type="submit" size="touch" disabled={!parsed}>
                {t('join.next')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </PageShell>
    )
  }
  return <JoinWithCode code={code} />
}

function JoinWithCode({ code }: { code: string }) {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const status = useAuth((s) => s.status)
  const profile = useAuth((s) => s.profile)
  const info = useAsync(() => checkInvite(code), [code])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (info.status === 'loading' || status === 'loading') return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  if (info.status === 'error') {
    return (
      <PageShell title={t('join.title')}>
        <Notice tone="error">{errorMessage(t, info.error)}</Notice>
      </PageShell>
    )
  }
  const invite = info.value
  if (!invite) {
    return (
      <PageShell title={t('join.title')}>
        <Notice tone="error">{t('join.invalid')}</Notice>
        <Button asChild variant="outline" size="touch">
          <Link to="/rejoindre">{t('join.otherCode')}</Link>
        </Button>
      </PageShell>
    )
  }

  const heading =
    invite.kind === 'class' ? (
      <CardHeader>
        <CardTitle>{t('join.classInvite', { name: invite.className })}</CardTitle>
        <CardDescription>{t('join.classTeacher', { teacher: invite.teacherName })}</CardDescription>
      </CardHeader>
    ) : (
      <CardHeader>
        <CardTitle>{t(`join.staffInvite.${invite.role}`)}</CardTitle>
        <CardDescription>{t('join.staffHint')}</CardDescription>
      </CardHeader>
    )

  // Déjà connecté : un élève rejoint la classe ; une invitation de prof sert à créer un nouveau compte.
  if (status === 'signedIn' && profile) {
    if (invite.kind === 'staff' || isStaff(profile)) {
      return (
        <PageShell title={t('join.title')}>
          <Card>{heading}</Card>
          <Notice>{t('join.alreadySignedIn', { name: profile.display_name })}</Notice>
        </PageShell>
      )
    }
    const join = async () => {
      setBusy(true)
      setError(null)
      try {
        await joinClass(code)
        navigate('/compte')
      } catch (err) {
        setError(errorMessage(t, err))
      } finally {
        setBusy(false)
      }
    }
    return (
      <PageShell title={t('join.title')}>
        <Card>
          {heading}
          <CardContent className="flex flex-col gap-3">
            {error && <Notice tone="error">{error}</Notice>}
            <Button size="touch" onClick={join} disabled={busy}>
              {t('join.joinClass')}
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell title={t('join.title')}>
      <Card>
        {heading}
        <CardContent>
          <SignUpForm code={code} busy={busy} setBusy={setBusy} />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        {t('join.haveAccount')}{' '}
        <Link to={`/connexion?suite=${encodeURIComponent(`/rejoindre/${code}`)}`} className="font-medium text-green-deep underline">
          {t('join.signIn')}
        </Link>
      </p>
      <p className="text-xs text-muted-foreground">
        {t('join.codeShown', { code: formatInviteCode(code) })} ·{' '}
        <Link to="/confidentialite" className="underline">
          {t('privacy.link')}
        </Link>
      </p>
    </PageShell>
  )
}

function SignUpForm({ code, busy, setBusy }: { code: string; busy: boolean; setBusy: (b: boolean) => void }) {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adult, setAdult] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setError(null)
  }, [name, email, password])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(t('errors.weakPassword'))
      return
    }
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp({ email, password, displayName: name, invite: code })
      if (needsConfirmation) setConfirm(true)
      else navigate('/compte?bienvenue=1', { replace: true })
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  if (confirm) return <Notice tone="success">{t('join.checkEmail')}</Notice>

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t('fields.displayName')} htmlFor="name" hint={t('fields.displayNameHint')}>
        <Input id="name" required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t('fields.email')} htmlFor="email">
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t('fields.password')} htmlFor="password" hint={t('fields.passwordHint', { n: MIN_PASSWORD })}>
        <Input
          id="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--color-green-deep)]" checked={adult} onChange={(e) => setAdult(e.target.checked)} required />
        <span>{t('join.adult')}</span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="touch" disabled={busy || !adult}>
        {t('join.create')}
      </Button>
    </form>
  )
}

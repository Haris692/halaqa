import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, inputClass, Notice, PageShell } from '@/features/ui/PageShell'
import { requestPasswordReset, signIn } from '@/services/accounts'
import { errorMessage } from './errors'
import { safeNext } from './RequireAuth'
import { useAuth } from './store'

export function LoginPage() {
  const { t } = useTranslation('account')
  const [params] = useSearchParams()
  const next = safeNext(params.get('suite'))
  const status = useAuth((s) => s.status)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [sent, setSent] = useState(false)

  if (status === 'signedIn') return <Navigate to={next} replace />
  if (status === 'disabled') {
    return (
      <PageShell title={t('login.title')} narrow>
        <Notice>{t('disabled')}</Notice>
      </PageShell>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (forgot) {
        await requestPasswordReset(email, `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/compte`)
        setSent(true)
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell title={forgot ? t('login.forgotTitle') : t('login.title')} narrow>
      <Card>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label={t('fields.email')} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            {!forgot && (
              <Field label={t('fields.password')} htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            {sent && <Notice tone="success">{t('login.resetSent')}</Notice>}
            <Button type="submit" size="touch" disabled={busy}>
              {forgot ? t('login.sendReset') : t('login.submit')}
            </Button>
            <button
              type="button"
              className="self-start text-sm text-muted-foreground underline"
              onClick={() => {
                setForgot(!forgot)
                setError(null)
                setSent(false)
              }}
            >
              {forgot ? t('login.backToLogin') : t('login.forgot')}
            </button>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link to="/rejoindre" className="font-medium text-green-deep underline">
          {t('login.haveInvite')}
        </Link>
      </p>
    </PageShell>
  )
}

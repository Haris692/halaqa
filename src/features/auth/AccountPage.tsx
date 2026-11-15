import { LogOut, Trash2, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AccountHomeLinks } from './AccountLinks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { parseInviteInput } from '@/core/progress/invite'
import { Field, inputClass, Notice, PageShell } from '@/features/ui/PageShell'
import { useQuery } from '@/lib/query'
import { deleteMyAccount, joinClass, listClasses, removeMember, signOut, updateDisplayName, updatePassword } from '@/services/accounts'
import { errorMessage } from './errors'
import { MIN_PASSWORD } from './JoinPage'
import { useAuth } from './store'

export function AccountPage() {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const profile = useAuth((s) => s.profile)!
  const email = useAuth((s) => s.session?.user.email ?? '')
  const recovery = useAuth((s) => s.recovery)

  return (
    <PageShell title={t('title')} wide>
      {params.get('bienvenue') && <Notice tone="success">{t('welcome', { name: profile.display_name })}</Notice>}
      {recovery && <Notice>{t('password.recovery')}</Notice>}

      <AccountHomeLinks />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ProfileCard email={email} />
          <PasswordCard highlight={recovery} />
        </div>
        {profile.role === 'student' && <MyClasses />}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="touch"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            <LogOut /> {t('signOut')}
          </Button>
          <DeleteAccount />
        </CardContent>
      </Card>
      <Link to="/confidentialite" className="text-sm text-muted-foreground underline">
        {t('privacy.link')}
      </Link>
    </PageShell>
  )
}

function ProfileCard({ email }: { email: string }) {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)!
  const refresh = useAuth((s) => s.refreshProfile)
  const [name, setName] = useState(profile.display_name)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await updateDisplayName(profile.id, name)
      await refresh()
      setMsg({ tone: 'success', text: t('saved') })
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(t, err) })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('profile')} <Badge variant="secondary">{t(`roles.${profile.role}`)}</Badge>
        </CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-3">
          <Field label={t('fields.displayName')} htmlFor="display-name" hint={t('fields.displayNameHint')}>
            <Input id="display-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" variant="secondary" size="touch" className="self-start" disabled={name.trim() === profile.display_name || !name.trim()}>
            {t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function MyClasses() {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)!
  const classes = useQuery('classes:mine', listClasses)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const parsed = parseInviteInput(code)

  const join = async (e: FormEvent) => {
    e.preventDefault()
    if (!parsed) return
    try {
      await joinClass(parsed)
      setCode('')
      setMsg({ tone: 'success', text: t('classes.joined') })
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(t, err) })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-green-deep" /> {t('classes.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {classes.status === 'ready' && classes.value.length === 0 && <p className="text-sm text-muted-foreground">{t('classes.none')}</p>}
        {classes.status === 'ready' && (
          <ul className="flex flex-col divide-y divide-border">
            {classes.value.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{t('classes.teacher', { name: c.teacher?.display_name ?? '—' })}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(t('classes.leaveConfirm', { name: c.name }))) return
                    await removeMember(c.id, profile.id)
                  }}
                >
                  {t('classes.leave')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={join} className="flex flex-col gap-2">
          <Field label={t('classes.joinLabel')} htmlFor="join-code">
            <div className="flex gap-2">
              <Input id="join-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCDE-FGHJK" className={inputClass} />
              <Button type="submit" size="touch" disabled={!parsed}>
                {t('classes.join')}
              </Button>
            </div>
          </Field>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard({ highlight }: { highlight: boolean }) {
  const { t } = useTranslation('account')
  const clearRecovery = useAuth((s) => s.clearRecovery)
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setMsg({ tone: 'error', text: t('errors.weakPassword') })
      return
    }
    try {
      await updatePassword(password)
      setPassword('')
      clearRecovery()
      setMsg({ tone: 'success', text: t('password.changed') })
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(t, err) })
    }
  }

  return (
    <Card className={highlight ? 'ring-2 ring-gold' : undefined}>
      <CardHeader>
        <CardTitle>{t('password.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-3">
          <Field label={t('password.new')} htmlFor="new-password" hint={t('fields.passwordHint', { n: MIN_PASSWORD })}>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" variant="secondary" size="touch" className="self-start" disabled={!password}>
            {t('password.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteAccount() {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const word = t('delete.word')

  return (
    <>
      <Button variant="ghost" size="touch" className="text-destructive" onClick={() => setOpen(true)}>
        <Trash2 /> {t('delete.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.title')}</DialogTitle>
            <DialogDescription>{t('delete.text')}</DialogDescription>
          </DialogHeader>
          <Field label={t('delete.typeWord', { word })} htmlFor="delete-word">
            <Input id="delete-word" value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={typed.trim().toUpperCase() !== word.toUpperCase()}
              onClick={async () => {
                try {
                  await deleteMyAccount()
                  navigate('/')
                } catch (err) {
                  setError(errorMessage(t, err))
                }
              }}
            >
              {t('delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

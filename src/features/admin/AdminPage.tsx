import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatInviteCode, inviteLink } from '@/core/progress/invite'
import { errorMessage } from '@/features/auth/errors'
import { useAuth } from '@/features/auth/store'
import { Choice } from '@/features/ui/Choice'
import { Field, inputClass, Notice, PageShell } from '@/features/ui/PageShell'
import { useQuery } from '@/lib/query'
import { adminListUsers, adminSetRole, createStaffInvitation, deleteStaffInvitation, listStaffInvitations } from '@/services/accounts'
import type { AppRole } from '@/services/supabase'

const ROLES: readonly AppRole[] = ['student', 'teacher', 'admin']
const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

/** Administration minimale : invitations de professeurs et rôles des comptes. */
export function AdminPage() {
  const { t } = useTranslation('account')
  return (
    <PageShell title={t('admin.title')} wide>
      <Invitations />
      <Users />
    </PageShell>
  )
}

function Invitations() {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)!
  const list = useQuery('admin:invitations', listStaffInvitations)
  const [role, setRole] = useState<AppRole>('teacher')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await createStaffInvitation(profile.id, role, note)
      setNote('')
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.invitations')}</CardTitle>
        <CardDescription>{t('admin.invitationsHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={create} className="flex flex-col gap-3">
          <Choice
            label={t('admin.role')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'teacher' as const, label: t('roles.teacher') },
              { value: 'admin' as const, label: t('roles.admin') },
            ]}
          />
          <Field label={t('admin.note')} htmlFor="invite-note" hint={t('admin.noteHint')}>
            <Input id="invite-note" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" size="touch" className="self-start">
            <Plus /> {t('admin.create')}
          </Button>
        </form>
        {error && <Notice tone="error">{error}</Notice>}
        {list.status === 'error' && <Notice tone="error">{errorMessage(t, list.error)}</Notice>}
        {list.status === 'ready' && (
          <ul className="flex flex-col divide-y divide-border">
            {list.value.map((inv) => {
              const used = inv.used_at !== null
              const expired = !used && new Date(inv.expires_at) < new Date()
              const link = inviteLink(location.origin, import.meta.env.BASE_URL, inv.code)
              return (
                <li key={inv.code} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">{formatInviteCode(inv.code)}</span>
                      <Badge variant="secondary">{t(`roles.${inv.role}`)}</Badge>
                      {used && <Badge>{t('admin.used')}</Badge>}
                      {expired && <Badge variant="destructive">{t('admin.expired')}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.note ? `${inv.note} · ` : ''}
                      {used ? t('admin.usedOn', { date: dateFmt.format(new Date(inv.used_at!)) }) : t('admin.expires', { date: dateFmt.format(new Date(inv.expires_at)) })}
                    </p>
                  </div>
                  {!used && !expired && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(link)
                        setCopied(inv.code)
                      }}
                    >
                      <Copy /> {copied === inv.code ? t('invite.copied') : t('invite.copy')}
                    </Button>
                  )}
                  {!used && (
                    <Button variant="ghost" size="icon" aria-label={t('admin.revoke')} title={t('admin.revoke')} onClick={() => void deleteStaffInvitation(inv.code)}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Users() {
  const { t } = useTranslation('account')
  const me = useAuth((s) => s.profile)!
  const users = useQuery('admin:users', adminListUsers)
  const [error, setError] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Notice tone="error">{error}</Notice>}
        {users.status === 'error' && <Notice tone="error">{errorMessage(t, users.error)}</Notice>}
        {users.status === 'ready' && (
          <ul className="flex flex-col divide-y divide-border">
            {users.value.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} · {t('admin.since', { date: dateFmt.format(new Date(u.created_at)) })}
                  </p>
                </div>
                <Select
                  value={u.role}
                  disabled={u.id === me.id}
                  onValueChange={async (role) => {
                    setError(null)
                    try {
                      await adminSetRole(u.id, role as AppRole)
                    } catch (err) {
                      setError(errorMessage(t, err))
                    }
                  }}
                >
                  <SelectTrigger className="w-36" aria-label={t('admin.role')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

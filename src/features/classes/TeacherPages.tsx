import { Copy, Plus, RefreshCw, Share2, Trash2, UserMinus, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { formatInviteCode, inviteLink } from '@/core/progress/invite'
import { errorMessage } from '@/features/auth/errors'
import { useAuth } from '@/features/auth/store'
import { ProgressBoard } from '@/features/progress/ProgressBoard'
import { Field, inputClass, Notice, PageShell } from '@/features/ui/PageShell'
import { useQuery } from '@/lib/query'
import {
  createClass,
  deleteClass,
  getClass,
  getProfile,
  listClasses,
  listMembers,
  regenerateInviteCode,
  removeMember,
  updateClass,
} from '@/services/accounts'

/** Espace professeur : ses classes. */
export function TeacherHomePage() {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)!
  const classes = useQuery('classes:mine', listClasses)
  const [creating, setCreating] = useState(false)
  const mine = classes.status === 'ready' ? classes.value.filter((c) => c.teacher_id === profile.id) : []

  return (
    <PageShell
      title={t('teacher.title')}
      actions={
        <Button size="touch" onClick={() => setCreating(true)} aria-label={t('teacher.newClass')}>
          <Plus /> <span className="hidden sm:inline">{t('teacher.newClass')}</span>
        </Button>
      }
    >
      {classes.status === 'error' && <Notice tone="error">{errorMessage(t, classes.error)}</Notice>}
      {classes.status === 'ready' && mine.length === 0 && <Notice>{t('teacher.noClass')}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        {mine.map((c) => (
          <Link key={c.id} to={`/prof/classe/${c.id}`} className="block">
            <Card className="h-full transition-colors hover:border-green-deep">
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Users className="size-4" /> {t('teacher.students', { count: c.members[0]?.count ?? 0 })}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <NotesHint />
      <CreateClassDialog open={creating} onOpenChange={setCreating} />
    </PageShell>
  )
}

function NotesHint() {
  const { t } = useTranslation('account')
  return <p className="text-sm text-muted-foreground">{t('teacher.notesHint')}</p>
}

function CreateClassDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const profile = useAuth((s) => s.profile)!
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const id = await createClass(profile.id, name)
      onOpenChange(false)
      setName('')
      navigate(`/prof/classe/${id}`)
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('teacher.newClass')}</DialogTitle>
          </DialogHeader>
          <Field label={t('teacher.className')} htmlFor="class-name">
            <Input id="class-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <DialogFooter>
            <Button type="submit" size="touch" disabled={!name.trim()}>
              {t('teacher.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Une classe : invitation, élèves, réglages. */
export function ClassPage() {
  const { t } = useTranslation('account')
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const cls = useQuery(`classes:${id}`, () => getClass(id))
  const members = useQuery(`classes:${id}:members`, () => listMembers(id))
  const [error, setError] = useState<string | null>(null)

  if (cls.status === 'loading') return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  if (cls.status === 'error' || !cls.value) {
    return (
      <PageShell title={t('teacher.title')} back="/prof">
        <Notice tone="error">{cls.status === 'error' ? errorMessage(t, cls.error) : t('teacher.notFound')}</Notice>
      </PageShell>
    )
  }
  const c = cls.value
  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  return (
    <PageShell title={c.name} back="/prof">
      {error && <Notice tone="error">{error}</Notice>}
      <InviteCard
        code={c.invite_code}
        open={c.invite_open}
        onToggle={(invite_open) => run(() => updateClass(c.id, { invite_open }))}
        onRegenerate={() => {
          if (confirm(t('invite.regenerateConfirm'))) void run(() => regenerateInviteCode(c.id))
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-green-deep" /> {t('teacher.studentList')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.status === 'ready' && members.value.length === 0 && <p className="text-sm text-muted-foreground">{t('teacher.noStudent')}</p>}
          {members.status === 'ready' && (
            <ul className="flex flex-col divide-y divide-border">
              {members.value.map((m) => (
                <li key={m.student_id} className="flex items-center gap-2 py-1">
                  <Link to={`/prof/eleve/${m.student_id}`} className="min-w-0 flex-1 truncate rounded-md px-2 py-2 font-medium hover:bg-muted">
                    {m.student?.display_name ?? '—'}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-touch"
                    aria-label={t('teacher.remove', { name: m.student?.display_name ?? '' })}
                    title={t('teacher.remove', { name: m.student?.display_name ?? '' })}
                    onClick={() => {
                      if (confirm(t('teacher.removeConfirm', { name: m.student?.display_name ?? '' }))) void run(() => removeMember(c.id, m.student_id))
                    }}
                  >
                    <UserMinus />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ClassSettings
        name={c.name}
        onRename={(name) => run(() => updateClass(c.id, { name }))}
        onDelete={() => {
          if (confirm(t('teacher.deleteConfirm', { name: c.name })))
            void run(async () => {
              await deleteClass(c.id)
              navigate('/prof')
            })
        }}
      />
    </PageShell>
  )
}

function InviteCard({
  code,
  open,
  onToggle,
  onRegenerate,
}: {
  code: string
  open: boolean
  onToggle: (open: boolean) => void
  onRegenerate: () => void
}) {
  const { t } = useTranslation('account')
  const link = inviteLink(location.origin, import.meta.env.BASE_URL, code)
  const [copied, setCopied] = useState(false)
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: t('invite.shareTitle'), text: t('invite.shareText'), url: link }).catch(() => undefined)
    } else {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invite.title')}</CardTitle>
        <CardDescription>{t('invite.text')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className={open ? '' : 'opacity-50'}>
          <p className="font-mono text-2xl tracking-widest text-green-deep" aria-label={t('invite.code')}>
            {formatInviteCode(code)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{link}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="touch" onClick={share} disabled={!open}>
            <Share2 /> {t('invite.share')}
          </Button>
          <Button
            variant="outline"
            size="touch"
            disabled={!open}
            onClick={async () => {
              await navigator.clipboard.writeText(link)
              setCopied(true)
            }}
          >
            <Copy /> {copied ? t('invite.copied') : t('invite.copy')}
          </Button>
          <Button variant="ghost" size="touch" onClick={onRegenerate}>
            <RefreshCw /> {t('invite.regenerate')}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={open} onCheckedChange={onToggle} /> {t('invite.open')}
        </label>
      </CardContent>
    </Card>
  )
}

function ClassSettings({ name, onRename, onDelete }: { name: string; onRename: (n: string) => void; onDelete: () => void }) {
  const { t } = useTranslation('account')
  const [value, setValue] = useState(name)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('teacher.settings')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onRename(value)
          }}
        >
          <Input value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} aria-label={t('teacher.className')} className={inputClass} />
          <Button type="submit" variant="secondary" size="touch" disabled={!value.trim() || value.trim() === name}>
            {t('save')}
          </Button>
        </form>
        <Button variant="ghost" size="touch" className="self-start text-destructive" onClick={onDelete}>
          <Trash2 /> {t('teacher.delete')}
        </Button>
      </CardContent>
    </Card>
  )
}

/** Progression d'un élève, vue et modifiée par son prof. */
export function StudentPage() {
  const { t } = useTranslation('account')
  const { id = '' } = useParams()
  const student = useQuery(`profiles:${id}`, () => getProfile(id))
  if (student.status === 'loading') return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  if (student.status === 'error' || !student.value) {
    return (
      <PageShell title={t('teacher.title')} back="/prof">
        <Notice tone="error">{student.status === 'error' ? errorMessage(t, student.error) : t('teacher.notFound')}</Notice>
      </PageShell>
    )
  }
  return (
    <PageShell title={student.value.display_name} back="/prof" wide>
      <p className="text-sm text-muted-foreground">{t('teacher.progressHint')}</p>
      <ProgressBoard studentId={id} editor="teacher" />
    </PageShell>
  )
}

/** Progression de l'élève connecté. */
export function MyProgressPage() {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)!
  return (
    <PageShell title={t('myProgress')} wide>
      <p className="text-sm text-muted-foreground">{t('progress.intro')}</p>
      <ProgressBoard studentId={profile.id} editor="student" />
    </PageShell>
  )
}

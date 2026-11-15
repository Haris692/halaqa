import { ArrowDown, ArrowUp, Plus, Radio, Trash2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_PLAN, parsePlan, planMinutes, STEP_KEYS, type PlanStep, type StepKey } from '@/core/live/live'
import { TAJWEED_FAMILIES } from '@/core/tajweed/rules'
import { errorMessage } from '@/features/auth/errors'
import { useAuth } from '@/features/auth/store'
import { Field, inputClass, Notice, PageShell } from '@/features/ui/PageShell'
import { useQuery } from '@/lib/query'
import { useAsync } from '@/lib/useAsync'
import { createSession, deleteSession, getSession, listSessions, startSession, updateSession, type LiveSessionRow } from '@/services/live'
import { loadMeta } from '@/services/quran-data'
import { useLive } from './store'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

/** Carte « Séances » de la page de classe (prof). */
export function SessionsCard({ classId }: { classId: string }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const profile = useAuth((s) => s.profile)!
  const sessions = useQuery(`sessions:${classId}`, () => listSessions(classId))
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    try {
      const id = await createSession(classId, profile.id, t('editor.defaultTitle', { date: new Date().toLocaleDateString('fr-FR') }), DEFAULT_PLAN)
      navigate(`/prof/seance/${id}`)
    } catch (e) {
      setError(errorMessage(t, e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="size-5 text-green-deep" /> {t('sessions.title')}
        </CardTitle>
        <CardDescription>{t('sessions.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button size="touch" className="self-start" onClick={create}>
          <Plus /> {t('sessions.prepare')}
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
        {sessions.status === 'ready' && sessions.value.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {sessions.value.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <Link to={s.status === 'live' ? `/seance/${s.id}` : `/prof/seance/${s.id}`} className="min-w-0 flex-1 rounded-md px-1 py-1 hover:bg-muted">
                  <p className="truncate font-medium">{s.title || t('sessions.untitled')}</p>
                  <p className="text-xs text-muted-foreground">{dateFmt.format(new Date(s.started_at ?? s.created_at))}</p>
                </Link>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: LiveSessionRow['status'] }) {
  const { t } = useTranslation('live')
  return (
    <Badge variant={status === 'live' ? 'destructive' : 'secondary'} className="gap-1">
      {status === 'live' && <Radio className="size-3" />} {t(`status.${status}`)}
    </Badge>
  )
}

/** Préparation d'une séance : titre, passage du jour, règle de la semaine, plan et durées. */
export function SessionEditorPage() {
  const { t } = useTranslation('live')
  const { id = '' } = useParams()
  const session = useQuery(`sessions:one:${id}`, () => getSession(id))
  if (session.status === 'loading') return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  if (session.status === 'error' || !session.value) {
    return (
      <PageShell title={t('editor.title')} back="/prof">
        <Notice tone="error">{session.status === 'error' ? errorMessage(t, session.error) : t('notFound')}</Notice>
      </PageShell>
    )
  }
  return <Editor key={session.value.id} session={session.value} />
}

function Editor({ session }: { session: LiveSessionRow }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const meta = useAsync(loadMeta, [])
  const [title, setTitle] = useState(session.title)
  const [plan, setPlan] = useState<PlanStep[]>(() => parsePlan(session.plan))
  const initialPassage = session.passage as { surah: number; from: number; to: number } | null
  const [passage, setPassage] = useState(initialPassage ?? { surah: 112, from: 1, to: 4 })
  const [hasPassage, setHasPassage] = useState(initialPassage !== null)
  const [focus, setFocus] = useState(session.tajweed_focus ?? '')
  const [notes, setNotes] = useState(session.notes ?? '')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const save = async () => {
    await updateSession(session.id, {
      title,
      plan,
      passage: hasPassage ? passage : null,
      tajweed_focus: focus || null,
      notes: notes.trim() || null,
    })
  }
  const run = async (fn: () => Promise<void>, ok?: string) => {
    setMsg(null)
    try {
      await fn()
      if (ok) setMsg({ tone: 'success', text: ok })
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(t, e) })
    }
  }
  const setStepAt = (i: number, patch: Partial<PlanStep>) => setPlan((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const swap = (i: number, j: number) =>
    setPlan((p) => {
      const next = [...p]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  const surahs = meta.status === 'ready' ? meta.value : []
  const verseCount = surahs[passage.surah - 1]?.verses ?? 1
  const verses = Array.from({ length: verseCount }, (_, i) => i + 1)

  return (
    <PageShell title={t('editor.title')} back={`/prof/classe/${session.class_id}`} wide>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Field label={t('editor.name')} htmlFor="session-title">
              <Input id="session-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={hasPassage} onCheckedChange={setHasPassage} /> {t('editor.passage')}
            </label>
            {hasPassage && (
              <div className="flex flex-wrap items-end gap-2">
                <Select value={String(passage.surah)} onValueChange={(v) => setPassage({ surah: Number(v), from: 1, to: Math.min(surahs[Number(v) - 1]?.verses ?? 1, 10) })}>
                  <SelectTrigger className="w-56" aria-label={t('editor.surah')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {surahs.map((m) => (
                      <SelectItem key={m.n} value={String(m.n)}>
                        {m.n}. {m.translit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(['from', 'to'] as const).map((k) => (
                  <Select key={k} value={String(passage[k])} onValueChange={(v) => setPassage((p) => ({ ...p, [k]: Number(v) }))}>
                    <SelectTrigger className="w-24" aria-label={t(`editor.${k}`)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {verses.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {t(`editor.${k}`)} {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            )}
            <Field label={t('editor.tajweed')} htmlFor="tajweed-focus">
              <Select value={focus || 'none'} onValueChange={(v) => setFocus(v === 'none' ? '' : v)}>
                <SelectTrigger id="tajweed-focus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('editor.noTajweed')}</SelectItem>
                  {TAJWEED_FAMILIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`reader:tajweed.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('editor.notes')} htmlFor="session-notes" hint={t('editor.notesHint')}>
              <Textarea id="session-notes" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('editor.plan', { minutes: planMinutes(plan) })}</CardTitle>
            <CardDescription>{t('editor.planHint')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ol className="flex flex-col gap-2">
              {plan.map((step, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                  <span className="w-5 text-center text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                  <Select value={step.key} onValueChange={(v) => setStepAt(i, { key: v as StepKey })}>
                    <SelectTrigger className="w-44" aria-label={t('editor.stepType')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(`steps.${k}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={step.title ?? ''}
                    placeholder={t(`steps.${step.key}`)}
                    maxLength={60}
                    onChange={(e) =>
                      setPlan((p) =>
                        p.map((x, j) => {
                          if (j !== i) return x
                          const { title: _old, ...rest } = x
                          return e.target.value ? { ...rest, title: e.target.value } : rest
                        }),
                      )
                    }
                    className="h-9 min-w-32 flex-1"
                    aria-label={t('editor.stepTitle')}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={step.minutes}
                    onChange={(e) => setStepAt(i, { minutes: Math.max(1, Math.min(180, Number(e.target.value) || 1)) })}
                    className="h-9 w-20"
                    aria-label={t('editor.minutes')}
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                  <div className="ms-auto flex">
                    <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label={t('editor.up')}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={i === plan.length - 1} onClick={() => swap(i, i + 1)} aria-label={t('editor.down')}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setPlan((p) => p.filter((_, j) => j !== i))} aria-label={t('editor.remove')}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPlan((p) => [...p, { key: 'custom', minutes: 5 }])}>
                <Plus /> {t('editor.addStep')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPlan([...DEFAULT_PLAN])}>
                {t('editor.resetPlan')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="touch" onClick={() => run(save, t('editor.saved'))}>
          {t('editor.save')}
        </Button>
        <Button
          size="touch"
          disabled={plan.length === 0}
          onClick={() =>
            run(async () => {
              await save()
              await startSession(session.id)
              navigate(`/seance/${session.id}`)
            })
          }
        >
          <Radio /> {session.status === 'live' ? t('editor.goLive') : t('editor.start')}
        </Button>
        {session.status !== 'live' && (
          <Button
            variant="ghost"
            size="touch"
            className="ms-auto text-destructive"
            onClick={() => {
              if (confirm(t('editor.deleteConfirm'))) void run(async () => {
                await deleteSession(session.id)
                navigate(`/prof/classe/${session.class_id}`)
              })
            }}
          >
            <Trash2 /> {t('editor.delete')}
          </Button>
        )}
      </div>
    </PageShell>
  )
}

/** Entrée dans la séance : choix micro / caméra / audio seul, puis lecteur au passage du jour. */
export function LobbyPage() {
  const { t } = useTranslation('live')
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const profile = useAuth((s) => s.profile)!
  const prefs = useLive((s) => s.prefs)
  const joined = useLive((s) => s.sessionId === id && s.state !== null)
  const [session, setSession] = useState<LiveSessionRow | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  // la page attend l'ouverture par le prof (vérification toutes les 10 s)
  useEffect(() => {
    let alive = true
    const load = () =>
      getSession(id).then(
        (s) => alive && setSession(s),
        (e: unknown) => alive && setError(errorMessage(t, e)),
      )
    void load()
    const timer = setInterval(load, 10_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [id, t])

  if (session === undefined) return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  if (!session) {
    return (
      <PageShell title={t('lobby.title')}>
        <Notice tone="error">{error ?? t('notFound')}</Notice>
      </PageShell>
    )
  }

  const passage = session.passage as { surah: number; from: number } | null
  const enter = async () => {
    setError(null)
    await useLive.getState().join(session.id)
    const err = useLive.getState().error
    if (err) return setError(errorMessage(t, { message: err }))
    navigate(passage ? `/lire/${passage.surah}?v=${passage.from}` : '/')
  }
  const isTeacher = session.created_by === profile.id

  return (
    <PageShell title={session.title || t('lobby.title')} narrow>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusBadge status={session.status} />
          </CardTitle>
          <CardDescription>
            {session.status === 'live' ? t('lobby.liveHint') : session.status === 'planned' ? t('lobby.waiting') : t('lobby.ended')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {session.status !== 'ended' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={prefs.mic} onCheckedChange={(mic) => useLive.getState().setPrefs({ mic })} /> {t('lobby.mic')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={prefs.camera && !prefs.audioOnly} disabled={prefs.audioOnly} onCheckedChange={(camera) => useLive.getState().setPrefs({ camera })} />{' '}
                {t('lobby.camera')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={prefs.audioOnly} onCheckedChange={(audioOnly) => useLive.getState().setPrefs({ audioOnly })} /> {t('lobby.audioOnly')}
              </label>
              <p className="text-xs text-muted-foreground">{t('lobby.recitersLocal')}</p>
            </>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {session.status === 'live' && (
            <Button size="touch" onClick={enter}>
              <Video /> {joined ? t('lobby.back') : t('lobby.join')}
            </Button>
          )}
          {session.status === 'planned' && isTeacher && (
            <Button asChild size="touch">
              <Link to={`/prof/seance/${session.id}`}>{t('lobby.prepare')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}

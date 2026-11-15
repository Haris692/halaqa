import { BookOpenText, DoorClosed, Hand, ListChecks, LogIn, Megaphone, Mic, Shuffle, SkipBack, SkipForward, Square, Undo2, Users } from 'lucide-react'
import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatTimer, MAIN_ROOM_STEPS, minutesSince, randomGroups, roomsFor, stepRemaining } from '@/core/live/live'
import { errorMessage } from '@/features/auth/errors'
import { useAuth } from '@/features/auth/store'
import { Choice } from '@/features/ui/Choice'
import { cn } from '@/lib/utils'
import {
  announce,
  closeRoom,
  endSession,
  moveParticipant,
  openRooms,
  recallAll,
  setFloor,
  setFocusVerse,
  setStep,
  updateMe,
  type LiveParticipant,
  type LiveRoom,
  type LiveState,
} from '@/services/live'
import { setShowSummary } from '@/services/tools'
import { ErrorSummaryCard } from './ErrorSummary'
import { myParticipant, useLive } from './store'

/**
 * Tableau de bord du prof (Alt+D ou bouton du panneau de séance) : plan et minuteur,
 * talqîn, salles et binômes, mains levées, annonces, rappel général.
 */
export function Dashboard() {
  const { t } = useTranslation('live')
  const state = useLive((s) => s.state)
  const [error, setError] = useState<string | null>(null)
  const [openRoomsDialog, setOpenRoomsDialog] = useState(false)
  if (!state) return null

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await useLive.getState().refresh()
    } catch (e) {
      setError(errorMessage(t, e))
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && useLive.getState().setDashboardOpen(false)}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t('dashboard.title', { name: state.session.title || state.session.class_name })}</SheetTitle>
          <SheetDescription>{t('dashboard.shortcut')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-8">
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <RaisedHands state={state} run={run} />
          <PlanControls state={state} run={run} onRoomsStep={() => setOpenRoomsDialog(true)} />
          <Talqin state={state} run={run} />
          <Rooms state={state} run={run} onOpenRooms={() => setOpenRoomsDialog(true)} />
          <CommonReview state={state} run={run} />
          <Announce state={state} run={run} />
        </div>
        {openRoomsDialog && <OpenRoomsDialog state={state} run={run} onClose={() => setOpenRoomsDialog(false)} />}
      </SheetContent>
    </Sheet>
  )
}

type Run = (fn: () => Promise<unknown>) => Promise<void>
const students = (state: LiveState) => state.participants.filter((p) => !p.is_teacher)

function Section({ title, icon, children, actions }: { title: string; icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 text-sm font-semibold tracking-wide text-green-deep uppercase">
          {icon} {title}
        </h3>
        {actions}
      </header>
      {children}
    </section>
  )
}

function RaisedHands({ state, run }: { state: LiveState; run: Run }) {
  const { t } = useTranslation('live')
  const me = useAuth((s) => s.profile)!
  const hands = students(state)
    .filter((p) => p.hand_raised_at)
    .sort((a, b) => a.hand_raised_at!.localeCompare(b.hand_raised_at!))
  if (hands.length === 0) return null
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gold bg-gold/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Hand className="size-4" /> {t('dashboard.hands', { count: hands.length })}
      </p>
      {hands.map((p) => (
        <div key={p.user_id} className="flex items-center gap-2 text-sm">
          <span className="flex-1">
            {p.display_name} · {state.rooms.find((r) => r.id === p.room_id)?.name ?? '—'}
          </span>
          {p.room_id && (
            <Button size="sm" variant="outline" onClick={() => run(() => moveParticipant(state.session.id, me.id, p.room_id!))}>
              <LogIn /> {t('dashboard.goThere')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => run(() => updateMe(state.session.id, p.user_id, { hand_raised_at: null }))}>
            {t('dashboard.lowerHand')}
          </Button>
        </div>
      ))}
    </div>
  )
}

function PlanControls({ state, run, onRoomsStep }: { state: LiveState; run: Run; onRoomsStep: () => void }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const { plan } = state
  const index = state.session.current_step
  const step = plan[index]
  const left = stepRemaining(step, state.session.step_started_at, now)
  const hasBreakouts = state.rooms.some((r) => r.kind === 'breakout')

  const go = (next: number) =>
    run(async () => {
      await setStep(state.session.id, next)
      const target = plan[next]
      // retour en salle principale : rappel automatique ; étape « salles » : proposer l'ouverture
      if (target && MAIN_ROOM_STEPS.has(target.key) && hasBreakouts) await recallAll(state.session.id)
      if (target?.key === 'rooms' && !hasBreakouts) onRoomsStep()
    })

  return (
    <Section title={t('dashboard.plan')} icon={<BookOpenText className="size-4" />}>
      <ol className="flex flex-wrap gap-1.5">
        {plan.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => i !== index && void go(i)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                i === index ? 'border-green-deep bg-green-deep text-white' : i < index ? 'border-border text-muted-foreground line-through' : 'border-border',
              )}
            >
              {s.title ?? t(`steps.${s.key}`)} · {s.minutes} min
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="touch" disabled={index === 0} onClick={() => go(index - 1)} aria-label={t('dashboard.prevStep')}>
          <SkipBack />
        </Button>
        <span className={cn('min-w-20 text-center text-2xl font-semibold tabular-nums', left !== null && left < 0 && 'text-destructive')}>
          {left !== null ? formatTimer(left) : '—'}
        </span>
        <Button size="touch" disabled={index >= plan.length - 1} onClick={() => go(index + 1)}>
          {t('dashboard.nextStep')} <SkipForward />
        </Button>
        <Button
          variant="ghost"
          size="touch"
          className="ms-auto text-destructive"
          onClick={() => {
            if (!confirm(t('dashboard.endConfirm'))) return
            void run(async () => {
              await endSession(state.session.id)
              useLive.getState().leave()
              navigate('/prof')
            })
          }}
        >
          <Square /> {t('dashboard.end')}
        </Button>
      </div>
      {state.session.passage && <PassageLine state={state} />}
    </Section>
  )
}

function PassageLine({ state }: { state: LiveState }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const p = state.session.passage as { surah: number; from: number; to: number }
  return (
    <button type="button" className="self-start text-sm text-green-deep underline" onClick={() => navigate(`/lire/${p.surah}?v=${p.from}`)}>
      {t('dashboard.passage', { surah: p.surah, from: p.from, to: p.to })}
    </button>
  )
}

function Talqin({ state, run }: { state: LiveState; run: Run }) {
  const { t } = useTranslation('live')
  const me = useAuth((s) => s.profile)!
  const mainId = state.rooms.find((r) => r.kind === 'main')?.id
  const inMain = students(state).filter((p) => p.room_id === mainId)
  const floor = state.session.floor_user
  const myVerse = myParticipant(state, me.id)?.current_verse ?? null
  const sid = state.session.id

  return (
    <Section title={t('dashboard.talqin')} icon={<Mic className="size-4" />}>
      <p className="text-xs text-muted-foreground">{t('dashboard.talqinHint')}</p>
      <div className="flex flex-wrap gap-1.5">
        {inMain.map((p) => (
          <Button key={p.user_id} variant={floor === p.user_id ? 'default' : 'outline'} size="sm" onClick={() => run(() => setFloor(sid, p.user_id))}>
            {p.hand_raised_at && <Hand />} {p.display_name}
          </Button>
        ))}
        {inMain.length === 0 && <span className="text-sm text-muted-foreground">{t('dashboard.nobodyInMain')}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={inMain.length === 0}
          onClick={() => {
            const pool = inMain.filter((p) => p.user_id !== floor)
            const pick = pool[Math.floor(Math.random() * pool.length)] ?? inMain[0]
            if (pick) void run(() => setFloor(sid, pick.user_id))
          }}
        >
          <Shuffle /> {t('dashboard.randomFloor')}
        </Button>
        <Button variant="outline" size="sm" disabled={!floor} onClick={() => run(() => setFloor(sid, null))}>
          <Undo2 /> {t('dashboard.releaseFloor')}
        </Button>
        <Button variant="outline" size="sm" disabled={!myVerse} onClick={() => run(() => setFocusVerse(sid, myVerse))}>
          {t('dashboard.focusMine', { verse: myVerse ?? '—' })}
        </Button>
        {state.session.focus_verse && (
          <Button variant="ghost" size="sm" onClick={() => run(() => setFocusVerse(sid, null))}>
            {t('dashboard.focusClear', { verse: state.session.focus_verse })}
          </Button>
        )}
      </div>
    </Section>
  )
}

function Rooms({ state, run, onOpenRooms }: { state: LiveState; run: Run; onOpenRooms: () => void }) {
  const { t } = useTranslation('live')
  const me = useAuth((s) => s.profile)!
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const myRoom = myParticipant(state, me.id)?.room_id
  const hasBreakouts = state.rooms.some((r) => r.kind === 'breakout')
  const sid = state.session.id

  const onDrop = (room: LiveRoom) => (e: DragEvent) => {
    e.preventDefault()
    const userId = e.dataTransfer.getData('text/halaqa-user')
    if (userId) void run(() => moveParticipant(sid, userId, room.id))
  }

  return (
    <Section
      title={t('dashboard.rooms')}
      icon={<Users className="size-4" />}
      actions={
        <div className="flex gap-1">
          <Button size="sm" onClick={onOpenRooms}>
            {hasBreakouts ? t('dashboard.reopenRooms') : t('dashboard.openRooms')}
          </Button>
          {hasBreakouts && (
            <Button size="sm" variant="outline" onClick={() => run(() => recallAll(sid))}>
              {t('dashboard.recall')}
            </Button>
          )}
        </div>
      }
    >
      {state.session.room_mode === 'free' && hasBreakouts && <p className="text-xs text-muted-foreground">{t('dashboard.freeMode')}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {state.rooms.map((room) => {
          const people = state.participants.filter((p) => p.room_id === room.id)
          const visited = minutesSince(room.teacher_visited_at, now)
          const status = roomStatus(people)
          return (
            <div
              key={room.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(room)}
              className={cn('flex flex-col gap-2 rounded-xl border p-3', myRoom === room.id ? 'border-green-deep bg-green-deep/5' : 'border-border')}
            >
              <div className="flex items-center gap-2">
                <p className="flex-1 font-medium">{room.name}</p>
                <Badge variant="secondary">{t(`roomStatus.${status}`)}</Badge>
              </div>
              <ul className="flex flex-wrap gap-1">
                {people.map((p) => (
                  <ParticipantChip key={p.user_id} p={p} state={state} run={run} now={now} />
                ))}
                {people.length === 0 && <li className="text-xs text-muted-foreground">{t('dashboard.empty')}</li>}
              </ul>
              <div className="flex items-center gap-1">
                {room.kind === 'breakout' && (
                  <span className="flex-1 text-xs text-muted-foreground">
                    {visited === null ? t('dashboard.neverVisited') : t('dashboard.visited', { count: visited })}
                  </span>
                )}
                {room.kind === 'main' && <span className="flex-1" />}
                {myRoom !== room.id && (
                  <Button size="sm" variant="outline" onClick={() => run(() => moveParticipant(sid, me.id, room.id))}>
                    <LogIn /> {t('dashboard.join')}
                  </Button>
                )}
                {room.kind === 'breakout' && (
                  <Button size="sm" variant="ghost" aria-label={t('dashboard.close')} title={t('dashboard.close')} onClick={() => run(() => closeRoom(sid, room.id))}>
                    <DoorClosed />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('dashboard.dragHint')}</p>
    </Section>
  )
}

/** État d'une salle pour la carte du tableau de bord. */
function roomStatus(people: LiveParticipant[]): 'raised' | 'reciting' | 'listening' | 'idle' {
  const s = people.filter((p) => !p.is_teacher)
  if (s.some((p) => p.hand_raised_at)) return 'raised'
  if (s.some((p) => p.activity === 'reciting')) return 'reciting'
  if (s.some((p) => p.activity === 'listening')) return 'listening'
  return 'idle'
}

function ParticipantChip({ p, state, run, now }: { p: LiveParticipant; state: LiveState; run: Run; now: number }) {
  const { t } = useTranslation('live')
  const away = now - Date.parse(p.last_seen_at) > 90_000
  const others = state.rooms.filter((r) => r.id !== p.room_id)
  return (
    <li
      draggable={!p.is_teacher}
      onDragStart={(e) => e.dataTransfer.setData('text/halaqa-user', p.user_id)}
      className={cn(
        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        p.is_teacher ? 'border-green-deep text-green-deep' : 'cursor-grab border-border bg-card',
        away && 'opacity-50',
      )}
      title={away ? t('dashboard.away') : undefined}
    >
      {p.hand_raised_at && <Hand className="size-3 text-gold" />}
      <span>{p.display_name}</span>
      {p.current_verse && <span className="text-muted-foreground">· {p.current_verse}</span>}
      {!p.is_teacher && others.length > 0 && (
        // déplacement au doigt (le glisser-déposer ne marche pas sur tablette)
        <select
          aria-label={t('dashboard.moveTo', { name: p.display_name })}
          className="ms-0.5 max-w-6 bg-transparent text-muted-foreground"
          value=""
          onChange={(e) => e.target.value && void run(() => moveParticipant(state.session.id, p.user_id, e.target.value))}
        >
          <option value="">→</option>
          {others.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </li>
  )
}

/** Retour commun : erreurs fréquentes relevées pendant les salles, affichables chez tous. */
function CommonReview({ state, run }: { state: LiveState; run: Run }) {
  const { t } = useTranslation('live')
  const shown = state.session.show_summary
  return (
    <Section
      title={t('summary.title')}
      icon={<ListChecks className="size-4" />}
      actions={
        <Button size="sm" variant={shown ? 'default' : 'outline'} aria-pressed={shown} onClick={() => run(() => setShowSummary(state.session.id, !shown))}>
          {shown ? t('summary.hide') : t('summary.show')}
        </Button>
      }
    >
      {shown && <p className="text-xs text-green-deep">{t('summary.shown')}</p>}
      <ErrorSummaryCard sessionId={state.session.id} />
    </Section>
  )
}

function Announce({ state, run }: { state: LiveState; run: Run }) {
  const { t } = useTranslation('live')
  const me = useAuth((s) => s.profile)!
  const [text, setText] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void run(async () => {
      await announce(state.session.id, me.id, text)
      setText('')
    })
  }
  return (
    <Section title={t('dashboard.announce')} icon={<Megaphone className="size-4" />}>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={t('dashboard.announcePlaceholder')} className="h-10" />
        <Button type="submit" disabled={!text.trim()}>
          {t('dashboard.send')}
        </Button>
      </form>
    </Section>
  )
}

/** Ouverture des salles : binômes ou individuelles, assignation (au hasard, modifiable) ou libre choix. */
function OpenRoomsDialog({ state, run, onClose }: { state: LiveState; run: Run; onClose: () => void }) {
  const { t } = useTranslation('live')
  const present = students(state)
  const [size, setSize] = useState<1 | 2>(2)
  const [mode, setMode] = useState<'assigned' | 'free'>('assigned')
  const [groups, setGroups] = useState<string[][]>(() => randomGroups(present.map((p) => p.user_id), 2))
  const name = (id: string) => present.find((p) => p.user_id === id)?.display_name ?? '—'
  const count = mode === 'free' ? roomsFor(present.length, size) : Math.max(1, groups.length)

  const reshuffle = (s: 1 | 2) => setGroups(randomGroups(present.map((p) => p.user_id), s))
  const move = (id: string, to: number) =>
    setGroups((gs) => {
      const next = gs.map((g) => g.filter((x) => x !== id))
      while (next.length <= to) next.push([])
      next[to]!.push(id)
      return next.filter((g) => g.length > 0)
    })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('openRooms.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Choice
            label={t('openRooms.size')}
            value={size}
            onChange={(s: 1 | 2) => {
              setSize(s)
              reshuffle(s)
            }}
            options={[
              { value: 2 as const, label: t('openRooms.pairs') },
              { value: 1 as const, label: t('openRooms.solo') },
            ]}
          />
          <Choice
            label={t('openRooms.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'assigned' as const, label: t('openRooms.assigned') },
              { value: 'free' as const, label: t('openRooms.free') },
            ]}
          />
          {mode === 'assigned' ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('openRooms.assignHint')}</p>
                <Button size="sm" variant="outline" onClick={() => reshuffle(size)}>
                  <Shuffle /> {t('openRooms.random')}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[...groups, []].map((g, i) => (
                  <div
                    key={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('text/halaqa-user')
                      if (id) move(id, i)
                    }}
                    className={cn('min-h-20 rounded-lg border p-2', g.length === 0 ? 'border-dashed text-muted-foreground' : 'border-border')}
                  >
                    <p className="mb-1 text-xs font-medium">{g.length === 0 ? t('openRooms.newRoom') : t('openRooms.room', { n: i + 1 })}</p>
                    <ul className="flex flex-wrap gap-1">
                      {g.map((id) => (
                        <li
                          key={id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/halaqa-user', id)}
                          className="flex cursor-grab items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs"
                        >
                          {name(id)}
                          <select
                            aria-label={t('dashboard.moveTo', { name: name(id) })}
                            className="max-w-6 bg-transparent"
                            value=""
                            onChange={(e) => e.target.value !== '' && move(id, Number(e.target.value))}
                          >
                            <option value="">→</option>
                            {[...groups, []].map((_, j) =>
                              j === i ? null : (
                                <option key={j} value={j}>
                                  {j < groups.length ? t('openRooms.room', { n: j + 1 }) : t('openRooms.newRoom')}
                                </option>
                              ),
                            )}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('openRooms.freeHint', { count })}</p>
          )}
          {present.length === 0 && <p className="text-sm text-destructive">{t('openRooms.nobody')}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => {
              const capacity = mode === 'free' ? size : Math.max(1, ...groups.map((g) => g.length))
              void run(() => openRooms(state.session.id, count, mode === 'assigned' ? groups : null, mode, capacity)).then(onClose)
            }}
          >
            {t('openRooms.confirm', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

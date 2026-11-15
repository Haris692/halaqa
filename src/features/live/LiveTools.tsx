import {
  BookOpenCheck,
  CircleAlert,
  Eraser,
  Hand,
  Highlighter,
  MousePointer2,
  PenLine,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { STROKE_COLORS } from '@/core/annotations/strokes'
import { quizLeadWords } from '@/core/live/tools'
import { parseVerseKey } from '@/core/quran/types'
import { errorMessage } from '@/features/auth/errors'
import { COLOR_HEX } from '@/features/annotations/StrokeLayer'
import { VerseText } from '@/features/reader/VerseText'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/utils'
import { loadSurah } from '@/services/quran-data'
import { endQuiz, revealQuiz, setRoomLeader, setRoomPen, startQuiz } from '@/services/tools'
import { useBoard, type BoardTool, type StrokeWidth } from './board'
import { useLive } from './store'
import { displayName, useRoomInfo, type RoomInfo } from './room'

/**
 * Barre d'outils de la salle, en haut du lecteur pendant une séance.
 * Prof : vue suivie, prise de main, crayon, laser, gomme, marquage, correction, test.
 * Élève : bandeau « le prof a la main », crayon s'il est autorisé, marquage des erreurs du binôme.
 */
export function LiveTools() {
  const info = useRoomInfo()
  const review = useBoard((s) => s.review)
  if (review) return <ReviewBanner />
  if (!info) return null
  return (
    <div className="sticky top-14 z-30 -mx-3 mb-3 flex flex-col gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur" role="toolbar" aria-label="Outils de la salle">
      {info.isTeacher ? <TeacherBar info={info} /> : <StudentBar info={info} />}
      <BoardError />
      {info.quiz && <QuizCard info={info} />}
    </div>
  )
}

function BoardError() {
  const error = useBoard((s) => s.error)
  if (!error) return null
  return (
    <p className="flex items-center gap-2 text-xs text-destructive" role="alert">
      {error}
      <button type="button" className="underline" onClick={() => useBoard.getState().set({ error: null })}>
        OK
      </button>
    </p>
  )
}

/** Action du prof : en cas de succès, l'état de la séance est rechargé tout de suite (sans attendre Realtime). */
function useAction() {
  const { t } = useTranslation('live')
  return (p: Promise<unknown>) =>
    p.then(
      () => useLive.getState().refresh(),
      (e: unknown) => useBoard.getState().set({ error: errorMessage(t, e) }),
    )
}

// ---------------------------------------------------------------- prof

function TeacherBar({ info }: { info: RoomInfo }) {
  const { t } = useTranslation('live')
  const run = useAction()
  const followChoice = useBoard((s) => s.followChoice)
  const focus = useBoard((s) => s.focusStudent)
  const tool = useBoard((s) => s.tool)
  const leading = info.leaderId === info.me
  // la case suit l'état de la salle, mais réagit tout de suite au clic
  const [pen, setPen] = useState(info.room.student_pen)
  useEffect(() => setPen(info.room.student_pen), [info.room.student_pen])

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t('tools.follow')}
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          value={leading ? '' : (followChoice ?? '')}
          disabled={leading}
          onChange={(e) => useBoard.getState().set({ followChoice: e.target.value || null })}
          aria-label={t('tools.follow')}
        >
          <option value="">{t('tools.followFree')}</option>
          {info.students.map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {t('tools.followOf', { name: s.display_name })}
            </option>
          ))}
        </select>
      </label>
      <Button
        size="sm"
        variant={leading ? 'default' : 'outline'}
        aria-pressed={leading}
        onClick={() => void run(setRoomLeader(info.room.id, !leading))}
      >
        <Hand /> {leading ? t('tools.release') : t('tools.take')}
      </Button>

      <ToolButtons info={info} withCorrect />
      <StyleControls />

      {tool === 'correct' || focus ? (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('tools.student')}
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={focus ?? ''}
            onChange={(e) => useBoard.getState().set({ focusStudent: e.target.value || null })}
            aria-label={t('tools.student')}
          >
            {!focus && <option value="">—</option>}
            {info.students.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="ms-auto flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!focus}
          onClick={() => focus && void run(startQuiz(info.room.id, focus))}
          title={focus ? t('tools.quizFor', { name: displayName(info, focus) }) : t('tools.noStudent')}
        >
          <BookOpenCheck /> {t('tools.quiz')}
        </Button>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            className="size-4 accent-green-deep"
            checked={pen}
            onChange={(e) => {
              setPen(e.target.checked)
              void run(setRoomPen(info.room.id, e.target.checked))
            }}
          />
          {t('tools.studentPen')}
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => window.confirm(t('tools.clearConfirm')) && void useBoard.getState().clearAll()}
        >
          <Trash2 /> {t('tools.clear')}
        </Button>
      </div>
      {leading && <p className="w-full text-xs text-green-deep">{t('tools.leading')}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- élève

function StudentBar({ info }: { info: RoomInfo }) {
  const { t } = useTranslation('live')
  const tool = useBoard((s) => s.tool)
  const focus = useBoard((s) => s.focusStudent)
  const partners = info.room.kind === 'breakout' ? info.students.filter((s) => s.user_id !== info.me) : []
  // un élève voit d'abord ses propres erreurs
  useEffect(() => {
    if (!useBoard.getState().focusStudent) useBoard.getState().set({ focusStudent: info.me })
  }, [info.me])
  // crayon retiré par le prof : retour à la lecture
  useEffect(() => {
    if (!info.canDraw && ['pen', 'laser', 'eraser', 'mark'].includes(useBoard.getState().tool)) useBoard.getState().set({ tool: 'none' })
  }, [info.canDraw])

  const leaderName = info.leaderId ? displayName(info, info.leaderId) : null
  if (!leaderName && !info.canDraw && partners.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {leaderName && <p className="text-sm font-medium text-green-deep">{t('tools.led', { name: leaderName })}</p>}
      {info.canDraw && (
        <>
          <ToolButtons info={info} withCorrect={false} />
          <StyleControls />
        </>
      )}
      {partners.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={focus === info.me && tool !== 'correct' ? 'secondary' : 'outline'}
            onClick={() => useBoard.getState().set({ focusStudent: info.me, tool: tool === 'correct' ? 'none' : tool })}
          >
            {t('tools.mine')}
          </Button>
          {partners.map((p) => (
            <Button
              key={p.user_id}
              size="sm"
              variant={tool === 'correct' && focus === p.user_id ? 'default' : 'outline'}
              aria-pressed={tool === 'correct' && focus === p.user_id}
              onClick={() => useBoard.getState().set({ tool: 'correct', focusStudent: p.user_id })}
            >
              <CircleAlert /> {t('tools.markPeer')} : {p.display_name}
            </Button>
          ))}
        </div>
      )}
      {info.canDraw && <p className="w-full text-xs text-muted-foreground">{t('tools.studentPenOn')}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- commun

const TOOL_ICONS: Record<Exclude<BoardTool, 'correct'>, ReactNode> = {
  none: <MousePointer2 />,
  pen: <PenLine />,
  laser: <Sparkles />,
  eraser: <Eraser />,
  mark: <Highlighter />,
}

function ToolButtons({ info, withCorrect }: { info: RoomInfo; withCorrect: boolean }) {
  const { t } = useTranslation('live')
  const tool = useBoard((s) => s.tool)
  const tools: BoardTool[] = ['none', 'pen', 'laser', 'eraser', 'mark']
  const choose = (next: BoardTool) => {
    const patch: Parameters<ReturnType<typeof useBoard.getState>['set']>[0] = { tool: next, menu: null }
    // corriger : par défaut l'élève dont on suit la vue, sinon le premier de la salle
    if (next === 'correct' && !useBoard.getState().focusStudent) {
      patch.focusStudent = useBoard.getState().followChoice ?? info.students[0]?.user_id ?? null
    }
    useBoard.getState().set(patch)
  }
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
      {tools.map((k) => (
        <Button
          key={k}
          size="icon"
          variant={tool === k ? 'default' : 'ghost'}
          aria-pressed={tool === k}
          aria-label={t(`tools.${k}`)}
          title={t(`tools.${k}`)}
          onClick={() => choose(k)}
        >
          {TOOL_ICONS[k as Exclude<BoardTool, 'correct'>]}
        </Button>
      ))}
      {withCorrect && (
        <Button size="sm" variant={tool === 'correct' ? 'default' : 'ghost'} aria-pressed={tool === 'correct'} onClick={() => choose('correct')}>
          <CircleAlert /> {t('tools.correct')}
        </Button>
      )}
    </div>
  )
}

function StyleControls() {
  const { t } = useTranslation('live')
  const tool = useBoard((s) => s.tool)
  const color = useBoard((s) => s.color)
  const width = useBoard((s) => s.width)
  const markKind = useBoard((s) => s.markKind)
  const rangeMode = useBoard((s) => s.rangeMode)
  if (tool !== 'pen' && tool !== 'mark') {
    if (tool === 'correct') return <span className="text-xs text-muted-foreground">{t('tools.correctHint')}</span>
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1" role="radiogroup" aria-label={t('tools.color')}>
        {STROKE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={t(`tools.colors.${c}`)}
            onClick={() => useBoard.getState().set({ color: c })}
            className={cn('size-7 rounded-full border-2', color === c ? 'border-foreground' : 'border-transparent')}
            style={{ background: COLOR_HEX[c] }}
          />
        ))}
      </div>
      {tool === 'pen' && (
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={width}
          onChange={(e) => useBoard.getState().set({ width: e.target.value as StrokeWidth })}
          aria-label={t('tools.width')}
        >
          {(['fine', 'medium', 'thick'] as const).map((w) => (
            <option key={w} value={w}>
              {t(`tools.widths.${w}`)}
            </option>
          ))}
        </select>
      )}
      {tool === 'mark' && (
        <>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={markKind}
            onChange={(e) => useBoard.getState().set({ markKind: e.target.value as 'highlight' | 'underline' })}
            aria-label={t('tools.mark')}
          >
            <option value="highlight">{t('tools.markKind.highlight')}</option>
            <option value="underline">{t('tools.markKind.underline')}</option>
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" className="size-4 accent-green-deep" checked={rangeMode} onChange={(e) => useBoard.getState().set({ rangeMode: e.target.checked })} />
            {t('tools.range')}
          </label>
          <span className="text-xs text-muted-foreground">{rangeMode ? t('tools.rangeHint') : t('tools.markHint')}</span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- test « continue le verset »

function QuizCard({ info }: { info: RoomInfo }) {
  const { t } = useTranslation('live')
  const run = useAction()
  const quiz = info.quiz!
  const { surah, verse } = parseVerseKey(quiz.verse)
  const text = useAsync(() => loadSurah(surah), [surah])
  const v = text.status === 'ready' ? text.value.verses.find((x) => x.n === verse) : undefined
  const name = displayName(info, quiz.student_id)
  const mine = quiz.student_id === info.me
  const [busy, setBusy] = useState(false)
  const act = (p: Promise<unknown>) => {
    setBusy(true)
    void run(p).finally(() => setBusy(false))
  }

  const lead = v ? quizLeadWords(v.words.length) : 0
  return (
    <section aria-label={t('quiz.title')} className="flex flex-col gap-2 rounded-xl border-2 border-gold/70 bg-card px-3 py-2" data-testid="quiz">
      <p className="text-sm font-semibold text-green-deep">
        {t('quiz.title')} · {quiz.verse} · {mine ? t('quiz.for', { name }) : t('quiz.forOther', { name })}
      </p>
      {v && (
        <div className="text-[1.6rem]">
          {quiz.revealed ? (
            <VerseText surah={surah} verse={v} verseActive={false} activeWord={null} />
          ) : (
            <p className="quran" dir="rtl">
              {v.words
                .slice(0, lead)
                .map((w) => w.t)
                .join(' ')}{' '}
              <span className="text-muted-foreground">…</span>
            </p>
          )}
        </div>
      )}
      {info.isTeacher && (
        <div className="flex flex-wrap gap-2">
          {!quiz.revealed && (
            <Button size="sm" disabled={busy} onClick={() => act(revealQuiz(info.room.id))}>
              {t('quiz.reveal')}
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act(startQuiz(info.room.id, quiz.student_id))}>
            {t('quiz.next')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(endQuiz(info.room.id))}>
            {t('quiz.end')}
          </Button>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- révision après la séance

function ReviewBanner() {
  const { t } = useTranslation('live')
  const review = useBoard((s) => s.review)!
  return (
    <div className="sticky top-14 z-30 -mx-3 mb-3 flex flex-wrap items-center gap-2 border-b border-gold/60 bg-gold-soft/60 px-3 py-2 text-sm backdrop-blur">
      <p className="min-w-0 flex-1">{t('recap.reviewBanner', { title: review.title })}</p>
      <BoardError />
      <Button size="sm" variant="outline" onClick={() => useBoard.getState().exitReview()}>
        {t('recap.reviewExit')}
      </Button>
    </div>
  )
}

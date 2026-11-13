import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  nearestWord,
  toAnchorPoint,
  wordsInRange,
  type AnchorFrame,
  type AnchorPoint,
  type StrokeAnchor,
} from '@/core/annotations/anchors'
import {
  applyMessage,
  emptyAnnotations,
  persistable,
  pruneLasers,
  type AnnotationMessage,
  type AnnotationState,
} from '@/core/annotations/protocol'
import {
  encodePoints,
  hitsPolyline,
  MAX_MESSAGE_BYTES,
  shouldKeepPoint,
  StrokeBatcher,
  type StrokeColor,
  type StrokeTool,
  type WordMark,
} from '@/core/annotations/strokes'
import { wordId, type SurahText, type VerseKey, type WordId } from '@/core/quran/types'
import { findFrame, useStrokeGeometry, verseRects, wordRects } from '@/features/annotations/geometry'
import { StrokeLayer } from '@/features/annotations/StrokeLayer'
import { MushafPageView } from '@/features/reader/MushafPageView'
import { VerseText } from '@/features/reader/VerseText'
import { asset } from '@/lib/asset'
import { useAsync } from '@/lib/useAsync'
import { loadMeta, loadPage, loadSurah } from '@/services/quran-data'
import { useLabChannel } from './channel'
import { PenToolbar, type PenView, type Tool } from './PenToolbar'

type Role = 'prof' | 'eleve'
type LocalAction = AnnotationMessage | { t: 'prune'; now: number }

const SURAHS = [1, 112, 113, 114]
const WIDTHS = { fine: 0.05, medium: 0.09, thick: 0.15 } as const

interface Drawing {
  id: string
  kind: StrokeAnchor['kind']
  frame: AnchorFrame
  batcher: StrokeBatcher
  last: AnchorPoint | undefined
  minDistance: number
}

export function PenLab() {
  const { t } = useTranslation('labs')
  const [params] = useSearchParams()
  const role: Role = params.get('role') === 'eleve' ? 'eleve' : 'prof'
  const selfId = useMemo(() => `${role}-${Math.random().toString(36).slice(2, 8)}`, [role])
  const counter = useRef(0)
  const nextId = () => `${selfId}-${++counter.current}`

  // ---------- état des annotations, partagé entre onglets ----------
  const [state, dispatch] = useReducer(
    (s: AnnotationState, a: LocalAction) => (a.t === 'prune' ? pruneLasers(s, a.now) : applyMessage(s, a, selfId)),
    undefined,
    emptyAnnotations,
  )
  const stateRef = useRef(state)
  stateRef.current = state
  const [studentPen, setStudentPen] = useState(false)
  const studentPenRef = useRef(studentPen)
  studentPenRef.current = studentPen

  const { send, stats } = useLabChannel((m) => {
    if (m.t === 'perm') return setStudentPen(m.studentPen)
    if (m.t === 'sync-request') {
      // simule la persistance : l'autre onglet renvoie les traits terminés
      if (m.from !== selfId) {
        send({ t: 'sync-state', to: m.from, ...persistable(stateRef.current) })
        if (role === 'prof') send({ t: 'perm', studentPen: studentPenRef.current })
      }
      return
    }
    dispatch(m)
  })
  useEffect(() => send({ t: 'sync-request', from: selfId }), [send, selfId])

  const emit = useCallback(
    (m: AnnotationMessage) => {
      dispatch(m)
      send(m)
    },
    [send],
  )

  // ---------- vue (propre à chaque onglet : écran et zoom différents) ----------
  const [view, setView] = useState<PenView>({
    mode: 'mushaf',
    page: 604,
    font: 'v2',
    mushafAnchor: 'page',
    readingAnchor: 'word',
    zoom: role === 'prof' ? 1.2 : 0.8,
  })
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<StrokeColor>('red')
  const [width, setWidth] = useState<keyof typeof WIDTHS>('medium')
  const [markKind, setMarkKind] = useState<WordMark['kind']>('highlight')
  const [rangeMode, setRangeMode] = useState(false)
  const [pendingStart, setPendingStart] = useState<WordId | null>(null)

  const canDraw = role === 'prof' || studentPen
  const effectiveTool: Tool = !canDraw && tool !== 'mark' && tool !== 'none' ? 'none' : tool

  // ---------- données ----------
  const data = useAsync(
    () => Promise.all([loadMeta(), loadPage(1), loadPage(604), Promise.all(SURAHS.map(loadSurah))]),
    [],
  )
  const ready = data.status === 'ready' ? data.value : null
  const texts = useMemo(() => new Map<number, SurahText>(ready ? ready[3].map((s) => [s.surah, s]) : []), [ready])
  const page = ready ? (view.page === 1 ? ready[1] : ready[2]) : null
  const pageSurahs = useMemo(
    () => (page ? [...new Set(page.lines.flatMap((l) => (l.type === 'text' ? [Number(l.words[0]!.split(':')[0])] : [])))] : []),
    [page],
  )
  const wordOrder = useMemo<WordId[]>(
    () =>
      pageSurahs.flatMap((s) => texts.get(s)?.verses.flatMap((v) => v.words.map((w) => wordId(s, v.n, w.p))) ?? []),
    [pageSurahs, texts],
  )

  // ---------- mise en page : tout changement force le recalcul des traits ----------
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [layoutTick, setLayoutTick] = useState(0)
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setLayoutTick((n) => n + 1))
    ro.observe(el)
    const onFonts = () => setLayoutTick((n) => n + 1)
    document.fonts.addEventListener('loadingdone', onFonts)
    return () => {
      ro.disconnect()
      document.fonts.removeEventListener('loadingdone', onFonts)
    }
  }, [ready])
  const layoutKey = `${view.mode}|${view.page}|${view.font}|${view.zoom}|${layoutTick}`
  const geometry = useStrokeGeometry(surfaceRef, state.strokes, layoutKey)

  // ---------- laser : fondu puis disparition ----------
  const [now, setNow] = useState(() => Date.now())
  const hasLaser = state.strokes.some((s) => s.style.tool === 'laser')
  useEffect(() => {
    if (!hasLaser) return
    let raf = 0
    const loop = () => {
      const n = Date.now()
      setNow(n)
      dispatch({ t: 'prune', now: n })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [hasLaser])

  // ---------- dessin ----------
  const drawing = useRef<Drawing | null>(null)
  const erasing = useRef(false)

  const anchorAt = (surface: HTMLElement, x: number, y: number): StrokeAnchor | null => {
    if (view.mode === 'mushaf' && view.mushafAnchor === 'page') return { kind: 'page', page: view.page }
    if (view.mode === 'reading' && view.readingAnchor === 'verse') {
      const verses = verseRects(surface)
      const inside = verses.find((v) => y >= v.rect.top && y <= v.rect.top + v.rect.height)
      const chosen = inside ?? verses[0]
      return chosen ? { kind: 'verse', verse: chosen.key as VerseKey } : null
    }
    const word = nearestWord({ x, y }, wordRects(surface))
    return word ? { kind: 'word', word } : null
  }

  const eraseAt = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current
    if (!surface) return
    const origin = surface.getBoundingClientRect()
    const p = { x: clientX - origin.left, y: clientY - origin.top }
    const ids = stateRef.current.strokes
      .filter((s) => (role === 'prof' || s.author === role) && geometry.get(s.id))
      .filter((s) => hitsPolyline(geometry.get(s.id)!.points, p, 10))
      .map((s) => s.id)
    if (ids.length) emit({ t: 'erase', ids })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current
    if (!surface) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (effectiveTool === 'eraser') {
      erasing.current = true
      return eraseAt(e.clientX, e.clientY)
    }
    if (effectiveTool !== 'pen' && effectiveTool !== 'laser') return
    const anchor = anchorAt(surface, e.clientX, e.clientY)
    const frame = anchor && findFrame(surface, anchor)
    if (!anchor || !frame) return
    const id = nextId()
    const toolKind: StrokeTool = effectiveTool
    emit({ t: 'stroke-start', id, author: role, anchor, style: { tool: toolKind, color, width: WIDTHS[width] } })
    const minDistance = anchor.kind === 'word' ? 1.5 / frame.fontPx : 1.5 / frame.box.width
    drawing.current = { id, kind: anchor.kind, frame, batcher: new StrokeBatcher(performance.now()), last: undefined, minDistance }
    addPoint(e.clientX, e.clientY)
  }

  const addPoint = (x: number, y: number) => {
    const d = drawing.current
    if (!d) return
    const pt = toAnchorPoint(d.kind, d.frame, { x, y })
    if (!shouldKeepPoint(d.last, pt, d.minDistance)) return
    d.last = pt
    dispatch({ t: 'stroke-points', id: d.id, pts: encodePoints([pt]) }) // affichage local immédiat
    const batch = d.batcher.push(pt, performance.now())
    if (batch) send({ t: 'stroke-points', id: d.id, pts: encodePoints(batch) })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (erasing.current) return eraseAt(e.clientX, e.clientY)
    if (!drawing.current) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events) addPoint(ev.clientX, ev.clientY)
  }

  const onPointerUp = () => {
    erasing.current = false
    const d = drawing.current
    if (!d) return
    drawing.current = null
    const batch = d.batcher.flush(performance.now())
    if (batch) send({ t: 'stroke-points', id: d.id, pts: encodePoints(batch) })
    emit({ t: 'stroke-end', id: d.id, endedAt: Date.now() })
  }

  // ---------- marquage de mots ----------
  const onWordClick = useCallback(
    (id: WordId, e: React.MouseEvent) => {
      if (effectiveTool !== 'mark') return
      if (rangeMode || e.shiftKey) {
        if (!pendingStart) return setPendingStart(id)
        const words = wordsInRange(wordOrder, pendingStart, id)
        setPendingStart(null)
        return emit({ t: 'mark', mark: { id: nextId(), author: role, words, kind: markKind, color } })
      }
      const existing = stateRef.current.marks.find((m) => m.words.includes(id) && (role === 'prof' || m.author === role))
      if (existing) return emit({ t: 'unmark', id: existing.id })
      emit({ t: 'mark', mark: { id: nextId(), author: role, words: [id], kind: markKind, color } })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveTool, rangeMode, pendingStart, wordOrder, markKind, color, role, emit],
  )

  const markClassByWord = useMemo(() => {
    const map = new Map<WordId, string>()
    for (const m of state.marks) {
      const cls = `mark-${m.kind}-${m.color}${m.author === 'eleve' ? ' mark-student' : ''}`
      for (const w of m.words) map.set(w, cls)
    }
    if (pendingStart) map.set(pendingStart, `${map.get(pendingStart) ?? ''} mark-pending`)
    return map
  }, [state.marks, pendingStart])
  const wordClass = useCallback((id: WordId) => markClassByWord.get(id), [markClassByWord])

  // ---------- rendu ----------
  const drawingActive = effectiveTool === 'pen' || effectiveTool === 'laser' || effectiveTool === 'eraser'
  const otherRole: Role = role === 'prof' ? 'eleve' : 'prof'
  const hiddenStrokes = state.strokes.filter((s) => !geometry.has(s.id)).length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-green-deep">{t('pen.title')}</h1>
          <p className="text-sm text-ink/70">{t('pen.intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold-soft px-3 py-1 text-sm font-medium text-green-deep">
            {t(`pen.role.${role}`)}
          </span>
          <button
            type="button"
            className="min-h-9 rounded-lg border border-green-deep/30 px-3 text-sm text-green-deep hover:bg-white/70"
            onClick={() => window.open(asset(`/labs/crayon?role=${otherRole}`), '_blank')}
          >
            {t('pen.openOther', { role: t(`pen.role.${otherRole}`) })}
          </button>
        </div>
      </header>

      <PenToolbar
        role={role}
        view={view}
        onView={setView}
        tool={tool}
        onTool={(next) => {
          setTool(next)
          setPendingStart(null)
        }}
        canDraw={canDraw}
        color={color}
        onColor={setColor}
        width={width}
        onWidth={setWidth}
        markKind={markKind}
        onMarkKind={setMarkKind}
        rangeMode={rangeMode}
        onRangeMode={setRangeMode}
        studentPen={studentPen}
        onStudentPen={(v) => {
          setStudentPen(v)
          send({ t: 'perm', studentPen: v })
        }}
        onClear={() => emit({ t: 'clear' })}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="overflow-auto rounded-xl border border-gold-soft bg-paper-deep/50 p-4">
          {data.status === 'loading' && <p>{t('common:loading')}</p>}
          {data.status === 'error' && <p className="text-red-700">{t('common:loadError', { message: data.error.message })}</p>}
          {ready && page && (
            <div ref={surfaceRef} className="relative mx-auto w-fit min-w-full">
              {view.mode === 'mushaf' ? (
                <MushafPageView
                  page={page}
                  texts={texts}
                  meta={ready[0]}
                  font={view.font}
                  scale={view.zoom}
                  wordClass={wordClass}
                  onWordClick={onWordClick}
                />
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-2" style={{ fontSize: 34 * view.zoom }}>
                  {pageSurahs.map((s) => {
                    const surahMeta = ready[0].find((m) => m.n === s)
                    return (
                      <section key={s} className="flex flex-col gap-2">
                        <h2 className="quran text-center text-green-deep" style={{ fontSize: '0.8em' }}>
                          سُورَةُ {surahMeta?.ar}
                        </h2>
                        {texts.get(s)?.verses.map((v) => (
                          <VerseText
                            key={v.n}
                            surah={s}
                            verse={v}
                            verseActive={false}
                            activeWord={null}
                            splitClusters={false}
                            wordClass={wordClass}
                            onWordClick={onWordClick}
                          />
                        ))}
                      </section>
                    )
                  })}
                </div>
              )}
              <StrokeLayer strokes={state.strokes} geometry={geometry} now={now} selfAuthor={role} />
              {drawingActive && (
                <div
                  className="absolute inset-0 touch-none"
                  style={{ cursor: effectiveTool === 'eraser' ? 'cell' : 'crosshair' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              )}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-2 rounded-xl border border-gold-soft bg-white/60 p-4 text-sm">
          <h2 className="text-sm font-semibold tracking-wide text-green-deep uppercase">{t('pen.stats')}</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-1 font-mono text-xs">
            <dt>{t('pen.sent')}</dt>
            <dd>{stats.sent}</dd>
            <dt>{t('pen.received')}</dt>
            <dd>{stats.received}</dd>
            <dt>{t('pen.maxBytes')}</dt>
            <dd className={stats.maxBytes > MAX_MESSAGE_BYTES ? 'text-red-700' : 'text-green-deep'}>
              {stats.maxBytes} / {MAX_MESSAGE_BYTES}
            </dd>
            <dt>{t('pen.latency')}</dt>
            <dd>{stats.lastLatencyMs === null ? '–' : `${stats.lastLatencyMs} ms`}</dd>
            <dt>{t('pen.strokes')}</dt>
            <dd>{state.strokes.length}</dd>
            <dt>{t('pen.marks')}</dt>
            <dd>{state.marks.length}</dd>
          </dl>
          {hiddenStrokes > 0 && <p className="text-xs text-ink/60">{t('pen.hidden', { count: hiddenStrokes })}</p>}
          <p className="mt-2 text-xs text-ink/60">{t('pen.howto')}</p>
        </aside>
      </div>
    </div>
  )
}


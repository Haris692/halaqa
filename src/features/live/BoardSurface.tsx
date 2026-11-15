import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { nearestWord, toAnchorPoint, wordsInRange, type AnchorFrame, type AnchorPoint } from '@/core/annotations/anchors'
import { encodePoints, hitsPolyline, shouldKeepPoint, StrokeBatcher } from '@/core/annotations/strokes'
import { visibleCorrections, wordClasses } from '@/core/live/tools'
import type { WordId } from '@/core/quran/types'
import { findFrame, useStrokeGeometry, wordRects } from '@/features/annotations/geometry'
import { StrokeLayer } from '@/features/annotations/StrokeLayer'
import { publish } from './bus'
import { STROKE_WIDTHS, useBoard } from './board'
import { CorrectionMenu } from './CorrectionMenu'
import { useRoomInfo } from './room'

/**
 * Calque des annotations posé sur le texte du lecteur (mode lecture ou Mushaf).
 * Les traits sont ancrés au mot le plus proche (décision de la phase 0) : ils restent
 * en place quels que soient l'écran, le zoom, le reflow ou le mode de chacun.
 */
export function BoardSurface({ children, layoutKey }: { children: ReactNode; layoutKey: unknown }) {
  const info = useRoomInfo()
  const active = useBoard((s) => s.roomId !== null || s.review !== null)
  const strokes = useBoard((s) => s.annotations.strokes)
  const tool = useBoard((s) => s.tool)
  const reviewTeacher = useBoard((s) => s.review?.teacherId ?? null)
  const teacherId = info?.teacherId ?? reviewTeacher
  const surfaceRef = useRef<HTMLDivElement>(null)

  // tout changement de mise en page force le recalcul des traits
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const el = surfaceRef.current
    if (!el || !active) return
    const ro = new ResizeObserver(() => setTick((n) => n + 1))
    ro.observe(el)
    const onFonts = () => setTick((n) => n + 1)
    document.fonts.addEventListener('loadingdone', onFonts)
    return () => {
      ro.disconnect()
      document.fonts.removeEventListener('loadingdone', onFonts)
    }
  }, [active])
  const geometry = useStrokeGeometry(surfaceRef, active ? strokes : NO_STROKES, `${String(layoutKey)}|${tick}`)

  // laser : fondu puis disparition
  const [now, setNow] = useState(() => Date.now())
  const hasLaser = strokes.some((s) => s.style.tool === 'laser')
  useEffect(() => {
    if (!hasLaser) return
    let raf = 0
    const loop = () => {
      const n = Date.now()
      setNow(n)
      useBoard.getState().pruneLasers(n)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [hasLaser])

  const canDraw = !!info?.canDraw && (tool === 'pen' || tool === 'laser' || tool === 'eraser')
  return (
    <div ref={surfaceRef} className="relative">
      {children}
      {active && (
        <StrokeLayer
          strokes={strokes}
          geometry={geometry}
          now={now}
          selfAuthor={info?.me ?? ''}
          isStudentAuthor={(a) => teacherId !== null && a !== teacherId}
        />
      )}
      {canDraw && <DrawingOverlay surfaceRef={surfaceRef} geometry={geometry} />}
      <CorrectionMenu />
    </div>
  )
}

const NO_STROKES: never[] = []

interface Drawing {
  id: string
  frame: AnchorFrame
  batcher: StrokeBatcher
  last: AnchorPoint | undefined
  minDistance: number
}

function DrawingOverlay({
  surfaceRef,
  geometry,
}: {
  surfaceRef: React.RefObject<HTMLDivElement | null>
  geometry: ReturnType<typeof useStrokeGeometry>
}) {
  const info = useRoomInfo()
  const tool = useBoard((s) => s.tool)
  const drawing = useRef<Drawing | null>(null)
  const erasing = useRef(false)
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry

  const eraseAt = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current
    if (!surface || !info) return
    const origin = surface.getBoundingClientRect()
    const p = { x: clientX - origin.left, y: clientY - origin.top }
    const ids = useBoard
      .getState()
      .annotations.strokes.filter((s) => (info.isTeacher || s.author === info.me) && geometryRef.current.get(s.id))
      .filter((s) => hitsPolyline(geometryRef.current.get(s.id)!.points, p, 10))
      .map((s) => s.id)
    useBoard.getState().erase(ids)
  }

  const addPoint = (x: number, y: number) => {
    const d = drawing.current
    if (!d) return
    const pt = toAnchorPoint('word', d.frame, { x, y })
    if (!shouldKeepPoint(d.last, pt, d.minDistance)) return
    d.last = pt
    // affichage local immédiat, envoi dans la salle par petits lots
    useBoard.setState((s) => ({
      annotations: { ...s.annotations, strokes: s.annotations.strokes.map((st) => (st.id === d.id ? { ...st, points: [...st.points, pt] } : st)) },
    }))
    const batch = d.batcher.push(pt, performance.now())
    if (batch) publish({ t: 'stroke-points', id: d.id, pts: encodePoints(batch) })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current
    if (!surface || !info) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'eraser') {
      erasing.current = true
      return eraseAt(e.clientX, e.clientY)
    }
    if (tool !== 'pen' && tool !== 'laser') return
    const word = nearestWord({ x: e.clientX, y: e.clientY }, wordRects(surface))
    const anchor = word ? ({ kind: 'word', word } as const) : null
    const frame = anchor && findFrame(surface, anchor)
    if (!anchor || !frame) return
    const { color, width } = useBoard.getState()
    const id = crypto.randomUUID()
    useBoard.getState().emit({ t: 'stroke-start', id, author: info.me, anchor, style: { tool, color, width: STROKE_WIDTHS[width] } })
    drawing.current = { id, frame, batcher: new StrokeBatcher(performance.now()), last: undefined, minDistance: 1.5 / frame.fontPx }
    addPoint(e.clientX, e.clientY)
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
    if (batch) publish({ t: 'stroke-points', id: d.id, pts: encodePoints(batch) })
    useBoard.getState().emit({ t: 'stroke-end', id: d.id, endedAt: Date.now() })
    useBoard.getState().finishStroke(d.id)
  }

  return (
    <div
      className="absolute inset-0 z-10 touch-none"
      style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
      data-testid="drawing-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}

/**
 * Classes des mots (marquages, corrections) et clic sur un mot pendant une séance :
 * marquer, corriger, ou voir l'erreur relevée. Renvoie `true` si le clic est pris en charge
 * (sinon le lecteur fait son action habituelle : écouter le mot).
 */
export function useBoardWords(wordOrder: readonly WordId[]) {
  const info = useRoomInfo()
  const active = useBoard((s) => s.roomId !== null || s.review !== null)
  const marks = useBoard((s) => s.annotations.marks)
  const corrections = useBoard((s) => s.corrections)
  const focus = useBoard((s) => s.focusStudent)
  const reviewTeacher = useBoard((s) => s.review?.teacherId ?? null)
  const teacherId = info?.teacherId ?? reviewTeacher
  const [pendingStart, setPendingStart] = useState<WordId | null>(null)
  const tool = useBoard((s) => s.tool)
  useEffect(() => {
    if (tool !== 'mark') setPendingStart(null)
  }, [tool])

  const shown = useMemo(() => visibleCorrections(corrections, focus), [corrections, focus])
  const classes = useMemo(
    () => (active ? wordClasses(marks, shown, teacherId, pendingStart) : null),
    [active, marks, shown, teacherId, pendingStart],
  )
  const wordClass = useCallback((id: WordId) => classes?.get(id), [classes])

  const orderRef = useRef(wordOrder)
  orderRef.current = wordOrder
  const onWordClick = useCallback(
    (id: WordId, e: React.MouseEvent): boolean => {
      const board = useBoard.getState()
      if (!board.roomId && !board.review) return false
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const at = { word: id, x: rect.left + rect.width / 2, y: rect.bottom }
      if (board.tool === 'mark' && info?.canDraw) {
        if (board.rangeMode || e.shiftKey) {
          if (!pendingStart) {
            setPendingStart(id)
            return true
          }
          const words = wordsInRange(orderRef.current, pendingStart, id)
          setPendingStart(null)
          if (words.length) board.addMark({ id: crypto.randomUUID(), author: info.me, words, kind: board.markKind, color: board.color })
          return true
        }
        const existing = board.annotations.marks.find((m) => m.words.includes(id) && (info.isTeacher || m.author === info.me))
        if (existing) board.removeMark(existing.id)
        else board.addMark({ id: crypto.randomUUID(), author: info.me, words: [id], kind: board.markKind, color: board.color })
        return true
      }
      if (board.tool === 'correct' && info) {
        board.set({ menu: at })
        return true
      }
      // sans outil : toucher un mot fautif montre l'erreur relevée
      if (visibleCorrections(board.corrections, board.focusStudent).some((c) => c.word === id)) {
        board.set({ menu: at })
        return true
      }
      return false
    },
    [info, pendingStart],
  )
  return { wordClass: active ? wordClass : undefined, onWordClick }
}

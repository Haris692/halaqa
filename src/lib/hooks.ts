import { useEffect, useRef, useState, type RefObject } from 'react'

/** Largeur d'un élément, suivie au redimensionnement. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

/**
 * Zoom au pincement (deux doigts) sur un élément : appelle `onScale` avec le
 * facteur relatif depuis le début du geste. Le zoom natif du navigateur est
 * neutralisé sur cet élément (touch-action) ; le défilement reste possible.
 */
export function usePinch(ref: RefObject<HTMLElement | null>, onScale: (factor: number, phase: 'start' | 'move') => void) {
  const cb = useRef(onScale)
  cb.current = onScale
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startDist = 0
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches)
        cb.current(1, 'start')
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault()
        cb.current(dist(e.touches) / startDist, 'move')
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) startDist = 0
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref])
}

/** Balayage horizontal (un doigt) : -1 vers la gauche, +1 vers la droite. */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (direction: -1 | 1) => void) {
  const cb = useRef(onSwipe)
  cb.current = onSwipe
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let x0 = 0
    let y0 = 0
    let t0 = 0
    let single = false
    const onStart = (e: TouchEvent) => {
      single = e.touches.length === 1
      x0 = e.touches[0]!.clientX
      y0 = e.touches[0]!.clientY
      t0 = Date.now()
    }
    const onEnd = (e: TouchEvent) => {
      if (!single) return
      const t = e.changedTouches[0]!
      const dx = t.clientX - x0
      const dy = t.clientY - y0
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - t0 < 600) cb.current(dx < 0 ? -1 : 1)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref])
}

/** Révèle un mot masqué pendant un instant (toucher un mot masqué). */
export function flashReveal(el: HTMLElement, ms = 1500) {
  el.classList.add('revealed')
  window.setTimeout(() => el.classList.remove('revealed'), ms)
}

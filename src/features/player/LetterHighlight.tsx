import { useEffect, useRef, type RefObject } from 'react'
import { letterIndexAt, splitLetters, wordProgress, ZWJ, type LetterCluster } from '@/core/audio-sync/letters'
import type { RecitationPlayer } from '@/services/audio/recitation-player'
import { rangeForOffsets, wordText } from './dom-range'

/**
 * Surlignage de la lettre en cours. Les deux approches à comparer en phase 0 :
 * elles s'exécutent à chaque image, en manipulant le DOM directement (aucun
 * re-rendu React à 60 i/s).
 */

function findWord(container: HTMLElement, verse: string, position: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-w="${verse}:${position}"]`)
}

function makeClusterCache() {
  const cache = new Map<string, LetterCluster[]>()
  return (id: string, text: string) => {
    let c = cache.get(id)
    if (!c) {
      c = splitLetters(text)
      cache.set(id, c)
    }
    return c
  }
}

/**
 * Approche A — le DOM du mot n'est pas touché : on mesure la position des
 * caractères de la lettre avec Range.getClientRects() et on dessine un
 * rectangle « derrière » (mélange multiply) à cet endroit.
 */
export function RangeLetterOverlay({
  player,
  containerRef,
}: {
  player: RecitationPlayer | null
  containerRef: RefObject<HTMLElement | null>
}) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!player) return
    const clustersOf = makeClusterCache()
    const range = document.createRange()
    const pool: HTMLDivElement[] = []
    let lastKey = ''

    const hideFrom = (n: number) => {
      for (let i = n; i < pool.length; i++) pool[i]!.style.display = 'none'
    }

    const unsubscribe = player.onFrame(({ ms, word }) => {
      const container = containerRef.current
      const layer = layerRef.current
      if (!container || !layer) return
      if (!word) {
        if (lastKey) hideFrom(0)
        lastKey = ''
        return
      }
      const el = findWord(container, word.verse, word.position)
      if (!el) return
      const id = `${word.verse}:${word.position}`
      const clusters = clustersOf(id, wordText(el))
      const idx = letterIndexAt(clusters, wordProgress(ms, word.start, word.end))
      const cluster = clusters[idx]
      if (!cluster) return
      // la clé inclut la taille du mot : on remesure si le zoom change
      const key = `${id}#${idx}#${el.offsetWidth}x${el.offsetHeight}`
      if (key === lastKey) return
      lastKey = key

      if (!rangeForOffsets(el, cluster.start, cluster.end, range)) return
      const rects = Array.from(range.getClientRects())
      const base = layer.getBoundingClientRect()
      rects.forEach((r, i) => {
        let div = pool[i]
        if (!div) {
          div = document.createElement('div')
          div.className = 'letter-overlay'
          layer.appendChild(div)
          pool.push(div)
        }
        div.style.display = 'block'
        div.style.left = `${r.left - base.left}px`
        div.style.top = `${r.top - base.top}px`
        div.style.width = `${r.width}px`
        div.style.height = `${r.height}px`
      })
      hideFrom(rects.length)
    })

    return () => {
      unsubscribe()
      for (const d of pool) d.remove()
    }
  }, [player, containerRef])

  return <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0" />
}

/**
 * Approche B — chaque lettre est dans son propre <span> (avec ZWJ aux
 * jointures) : on colore simplement le <span> de la lettre en cours.
 */
export function useClusterSpanHighlight(player: RecitationPlayer | null, containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!player || !enabled) return
    const clustersOf = makeClusterCache()
    let lastSpan: HTMLElement | null = null

    const clear = () => {
      lastSpan?.classList.remove('cluster-hl')
      lastSpan = null
    }

    const unsubscribe = player.onFrame(({ ms, word }) => {
      const container = containerRef.current
      if (!container) return
      if (!word) return clear()
      const el = findWord(container, word.verse, word.position)
      if (!el) return clear()
      const id = `${word.verse}:${word.position}`
      const clusters = clustersOf(id, (el.textContent ?? '').replaceAll(ZWJ, ''))
      const idx = letterIndexAt(clusters, wordProgress(ms, word.start, word.end))
      const span = el.querySelector<HTMLElement>(`[data-c="${idx}"]`)
      if (span === lastSpan) return
      clear()
      span?.classList.add('cluster-hl')
      lastSpan = span
    })

    return () => {
      unsubscribe()
      clear()
    }
  }, [player, containerRef, enabled])
}

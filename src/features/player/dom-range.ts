import { ZWJ } from '@/core/audio-sync/letters'

/**
 * Range DOM couvrant les caractères [start, end) du texte d'un mot, même quand
 * le mot est découpé en plusieurs <span> (tajwid, masquage) avec des ZWJ ajoutés :
 * les offsets sont ceux du texte coranique d'origine, ZWJ exclus.
 */
export function rangeForOffsets(el: HTMLElement, start: number, end: number, range: Range): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let pos = 0
  let startSet = false
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const data = node.data
    for (let i = 0; i <= data.length; i++) {
      if (!startSet && pos === start && i < data.length && data[i] !== ZWJ) {
        range.setStart(node, i)
        startSet = true
      }
      if (startSet && pos === end) {
        range.setEnd(node, i)
        return true
      }
      if (i < data.length && data[i] !== ZWJ) pos++
    }
  }
  if (startSet) {
    range.setEndAfter(el.lastChild ?? el)
    return true
  }
  return false
}

/** Texte coranique d'un mot affiché (ZWJ retirés). */
export const wordText = (el: HTMLElement) => (el.textContent ?? '').replaceAll(ZWJ, '')

import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { splitLetters } from '@/core/audio-sync/letters'
import { wordId, type SurahText } from '@/core/quran/types'
import { ClusterSpans } from '@/features/reader/VerseText'

/**
 * Banc d'essai des liaisons : chaque mot affiché trois fois, pour vérifier à
 * l'œil, navigateur par navigateur, que le découpage en lettres ne casse rien.
 *  1. texte normal (référence) ;
 *  2. approche B : un <span> par lettre, couleurs alternées ;
 *  3. approche A : texte intact, rectangles mesurés par Range pour chaque lettre.
 */
export function JoiningBench({ text, fontSize }: { text: SurahText; fontSize: number }) {
  const { t } = useTranslation('labs')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink/60">
            <th className="p-2 text-start">{t('bench.word')}</th>
            <th className="p-2">{t('bench.reference')}</th>
            <th className="p-2">{t('bench.spans')}</th>
            <th className="p-2">{t('bench.range')}</th>
          </tr>
        </thead>
        <tbody>
          {text.verses.flatMap((v) =>
            v.words.map((w) => (
              <tr key={wordId(text.surah, v.n, w.p)} className="border-t border-gold-soft/60">
                <td className="p-2 font-mono text-xs text-ink/60">{wordId(text.surah, v.n, w.p)}</td>
                <td className="quran p-2 text-center" style={{ fontSize }}>
                  {w.t}
                </td>
                <td className="quran p-2 text-center" style={{ fontSize }}>
                  <ClusterSpans text={w.t} colored />
                </td>
                <td className="quran p-2 text-center" style={{ fontSize }}>
                  <RangeBenchWord text={w.t} />
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

function RangeBenchWord({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [boxes, setBoxes] = useState<Box[]>([])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const node = el.firstChild
      if (!(node instanceof Text)) return
      const base = el.getBoundingClientRect()
      const range = document.createRange()
      const next: Box[] = []
      for (const c of splitLetters(text)) {
        range.setStart(node, c.start)
        range.setEnd(node, c.end)
        for (const r of Array.from(range.getClientRects())) {
          next.push({ left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height })
        }
      }
      setBoxes(next)
    }
    measure()
    void document.fonts.ready.then(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])

  return (
    <span ref={ref} className="relative inline-block">
      {text}
      {boxes.map((b, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-sm mix-blend-multiply"
          style={{ ...b, background: i % 2 ? 'rgba(220,38,38,.35)' : 'rgba(37,99,235,.35)' }}
        />
      ))}
    </span>
  )
}

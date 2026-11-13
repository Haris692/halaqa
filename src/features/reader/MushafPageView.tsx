import { memo, useEffect, useState } from 'react'
import type { MushafPage, QuranWord, SurahMeta, SurahText, WordId } from '@/core/quran/types'
import { loadPageFont } from '@/services/quran-data'

export type MushafFont = 'v2' | 'unicode'

/** Largeur de référence d'une page, multipliée par `scale`. */
export const PAGE_WIDTH = 460
const LINE_HEIGHT_RATIO = 0.105 // hauteur d'une ligne / largeur de page
const FONT_RATIO: Record<MushafFont, number> = { v2: 0.06, unicode: 0.05 }

export interface MushafPageViewProps {
  page: MushafPage
  texts: ReadonlyMap<number, SurahText>
  meta: readonly SurahMeta[]
  font: MushafFont
  scale: number
  wordClass?: (id: WordId) => string | undefined
  onWordClick?: (id: WordId, event: React.MouseEvent) => void
}

/**
 * Page du Mushaf en mise en page figée (15 lignes). Tout est proportionnel à la
 * largeur de la page : à n'importe quel zoom, un point (x, y) normalisé 0–1
 * désigne le même endroit du texte.
 */
export const MushafPageView = memo(function MushafPageView({
  page,
  texts,
  meta,
  font,
  scale,
  wordClass,
  onWordClick,
}: MushafPageViewProps) {
  const width = PAGE_WIDTH * scale
  const lineHeight = width * LINE_HEIGHT_RATIO
  const fontSize = width * FONT_RATIO[font]
  const pageFont = usePageFont(font === 'v2' ? page.page : null)
  const basmalaFont = usePageFont(font === 'v2' ? 1 : null)
  const centered = page.page <= 2

  const wordOf = (key: string): { word: QuranWord; isEnd: boolean } | null => {
    const [s, v, p] = key.split(':')
    const verse = texts.get(Number(s))?.verses.find((x) => x.n === Number(v))
    if (!verse) return null
    if (p === 'end') return { word: verse.end, isEnd: true }
    const word = verse.words.find((w) => w.p === Number(p))
    return word ? { word, isEnd: false } : null
  }

  const family = font === 'v2' ? (pageFont ? `'${pageFont}'` : 'transparent') : 'var(--font-quran)'
  const basmala = texts.get(1)?.verses[0]?.words ?? []

  return (
    <div
      data-page={page.page}
      className="relative mx-auto rounded-md border border-gold/60 bg-[#fffaf0] shadow-md"
      style={{ width, padding: `${lineHeight * 0.5}px ${width * 0.05}px`, fontSize }}
    >
      {page.lines.map((line) => {
        const style = { height: lineHeight, lineHeight: `${lineHeight}px` }
        if (line.type === 'surah') {
          const m = meta.find((x) => x.n === line.surah)
          return (
            <div key={line.n} style={style} className="flex items-center justify-center">
              <div
                className="quran rounded border-2 border-gold px-[2em] text-green-deep"
                style={{ lineHeight: `${lineHeight * 0.8}px`, fontSize: fontSize * 0.8, fontFamily: 'var(--font-quran)' }}
              >
                سُورَةُ {m?.ar}
              </div>
            </div>
          )
        }
        if (line.type === 'basmala') {
          return (
            <div
              key={line.n}
              style={{ ...style, fontFamily: font === 'v2' && basmalaFont ? `'${basmalaFont}'` : 'var(--font-quran)' }}
              className="quran flex justify-center gap-[0.3em] whitespace-nowrap"
            >
              {basmala.map((w) => (
                <span key={w.p}>{font === 'v2' ? w.g : w.t}</span>
              ))}
            </div>
          )
        }
        return (
          <div
            key={line.n}
            style={{ ...style, fontFamily: family }}
            className={`quran flex whitespace-nowrap ${centered ? 'justify-center gap-[0.25em]' : 'justify-between'}`}
          >
            {line.words.map((key) => {
              const found = wordOf(key)
              if (!found) return null
              const text = font === 'v2' ? found.word.g : found.word.t
              if (found.isEnd) {
                return (
                  <span key={key} className="text-green-deep select-none">
                    {text}
                  </span>
                )
              }
              const id = key as WordId
              return (
                <span
                  key={key}
                  data-w={id}
                  className={`cursor-pointer rounded-[0.15em] ${wordClass?.(id) ?? ''}`}
                  onClick={onWordClick ? (e) => onWordClick(id, e) : undefined}
                >
                  {text}
                </span>
              )
            })}
          </div>
        )
      })}
      <div className="text-center font-ui text-xs text-ink/50" style={{ fontSize: fontSize * 0.45 }}>
        {page.page}
      </div>
    </div>
  )
})

function usePageFont(page: number | null): string | null {
  const [family, setFamily] = useState<string | null>(null)
  useEffect(() => {
    if (page === null) return setFamily(null)
    let alive = true
    loadPageFont(page).then(
      (f) => alive && setFamily(f),
      () => alive && setFamily(null),
    )
    return () => {
      alive = false
    }
  }, [page])
  return family
}

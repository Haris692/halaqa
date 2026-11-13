import { memo, useEffect, useState } from 'react'
import type { MaskLevel } from '@/core/memorization/memorization'
import type { MushafPage, QuranWord, SurahMeta, VerseKey, WordId } from '@/core/quran/types'
import { cn } from '@/lib/utils'
import { loadPageFont } from '@/services/quran-data'

export type MushafFont = 'v2' | 'unicode'

/** Largeur de référence d'une page (le zoom des labos multiplie cette valeur). */
export const PAGE_WIDTH = 460
const LINE_HEIGHT_RATIO = 0.105 // hauteur d'une ligne / largeur de page
const FONT_RATIO: Record<MushafFont, number> = { v2: 0.06, unicode: 0.05 }

export interface MushafPageViewProps {
  page: MushafPage
  meta: readonly SurahMeta[]
  /** mots de la basmala (1:1), affichée en tête des sourates */
  basmala: readonly QuranWord[]
  font: MushafFont
  /** largeur de la page en pixels */
  width: number
  activeVerse?: VerseKey | null
  activeWord?: WordId | null
  selectedVerse?: VerseKey | null
  /** en glyphes V2, « première lettre » n'est pas possible : traité comme « estompé » */
  mask?: MaskLevel
  wordClass?: (id: WordId) => string | undefined
  onWordClick?: (id: WordId, event: React.MouseEvent) => void
  onVerseNumberClick?: (key: VerseKey) => void
}

/**
 * Page du Mushaf de Médine en mise en page figée (15 lignes). Tout est
 * proportionnel à la largeur : à n'importe quelle taille, un point (x, y)
 * normalisé 0–1 désigne le même endroit du texte.
 */
export const MushafPageView = memo(function MushafPageView({
  page,
  meta,
  basmala,
  font,
  width,
  activeVerse = null,
  activeWord = null,
  selectedVerse = null,
  mask = 'full',
  wordClass,
  onWordClick,
  onVerseNumberClick,
}: MushafPageViewProps) {
  const lineHeight = width * LINE_HEIGHT_RATIO
  const fontSize = width * FONT_RATIO[font]
  const pageFont = usePageFont(font === 'v2' ? page.page : null)
  const basmalaFont = usePageFont(font === 'v2' ? 1 : null)
  const centered = page.page <= 2
  const family = font === 'v2' ? (pageFont ? `'${pageFont}'` : 'transparent') : 'var(--font-quran)'
  const maskClass = mask === 'full' ? undefined : mask === 'first' && font === 'v2' ? 'mask-faded' : `mask-${mask}`

  return (
    <div
      data-page={page.page}
      className={cn('relative mx-auto rounded-md border border-gold/60 bg-[var(--mushaf-page)] shadow-md', maskClass)}
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
            className={cn('quran flex whitespace-nowrap', centered ? 'justify-center gap-[0.25em]' : 'justify-between')}
          >
            {line.words.map((w) => {
              const [s, v] = w.k.split(':')
              const vk = `${s}:${v}` as VerseKey
              if (w.e) {
                // marqueur de fin : glyphe V2 si disponible, sinon numéro Unicode en police QPC
                const useUnicode = font === 'unicode' || !w.g
                return (
                  <button
                    key={w.k}
                    type="button"
                    onClick={onVerseNumberClick ? () => onVerseNumberClick(vk) : undefined}
                    className={cn('rounded-full text-green-deep select-none', selectedVerse === vk && 'bg-gold-soft ring-2 ring-gold')}
                    style={useUnicode ? { fontFamily: 'var(--font-quran)' } : undefined}
                    aria-label={`Verset ${v}`}
                  >
                    {useUnicode ? w.t : w.g}
                  </button>
                )
              }
              const id = w.k as WordId
              return (
                <span
                  key={w.k}
                  data-w={id}
                  className={cn(
                    'rounded-[0.15em]',
                    onWordClick && 'cursor-pointer',
                    activeVerse === vk && 'verse-hl',
                    activeWord === id && 'word-hl',
                    wordClass?.(id),
                  )}
                  onClick={onWordClick ? (e) => onWordClick(id, e) : undefined}
                >
                  {font === 'v2' ? w.g : w.t}
                </span>
              )
            })}
          </div>
        )
      })}
      <div className="text-center font-ui text-muted-foreground" style={{ fontSize: fontSize * 0.45 }}>
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
    setFamily(null)
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

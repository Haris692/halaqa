import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TimedWord } from '@/core/audio-sync/timeline'
import type { MaskLevel } from '@/core/memorization/memorization'
import { verseKey, type QuranWord, type SurahMeta, type SurahText, type VerseKey, type WordId } from '@/core/quran/types'
import { RangeLetterOverlay } from '@/features/player/LetterHighlight'
import type { HighlightLevel } from '@/features/settings/store'
import { cn } from '@/lib/utils'
import type { RecitationPlayer } from '@/services/audio/recitation-player'
import { VerseText } from './VerseText'

export interface ReadingViewProps {
  meta: SurahMeta
  text: SurahText
  basmala: readonly QuranWord[]
  fontSize: number
  highlight: HighlightLevel
  activeVerse: VerseKey | null
  activeWord: TimedWord | null
  selectedVerse: VerseKey | null
  player: RecitationPlayer | null
  tajweed: boolean
  ruleFilter?: ((rule: string) => boolean) | undefined
  mask: MaskLevel
  /** n'afficher que ces versets (mode entraînement) */
  verseRange?: [number, number]
  showHeader?: boolean
  /** classes supplémentaires par mot (marquages, corrections de la séance) */
  wordClass?: ((id: WordId) => string | undefined) | undefined
  onWordClick?: (id: WordId, event: React.MouseEvent) => void
  onVerseNumberClick?: (key: VerseKey) => void
}

export interface ReadingViewHandle {
  container: HTMLDivElement | null
}

/** Mode lecture : verset par verset, le texte se recompose (idéal sur téléphone et en grande taille). */
export const ReadingView = forwardRef<ReadingViewHandle, ReadingViewProps>(function ReadingView(props, ref) {
  const { t } = useTranslation('reader')
  const containerRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({ container: containerRef.current }), [])
  const { meta, text, fontSize, highlight, activeVerse, activeWord, mask, verseRange } = props
  const verses = verseRange ? text.verses.filter((v) => v.n >= verseRange[0] && v.n <= verseRange[1]) : text.verses
  const showBasmala = meta.bismillah && meta.n !== 1 && meta.n !== 9 && (!verseRange || verseRange[0] === 1)

  return (
    <div className="flex flex-col gap-2">
      {props.showHeader !== false && (
        <header className="mx-auto mb-2 flex w-full max-w-xl flex-col items-center gap-1 rounded-xl border-2 border-gold/70 bg-card px-4 py-3 text-center">
          <p className="quran text-3xl leading-normal text-green-deep">سُورَةُ {meta.ar}</p>
          <p className="text-sm text-muted-foreground">
            {meta.n}. {meta.translit} — {meta.fr} · {t('versesCount', { count: meta.verses })} ·{' '}
            {t(meta.place === 'makkah' ? 'meccan' : 'medinan')}
          </p>
        </header>
      )}
      <div
        ref={containerRef}
        className={cn('relative flex flex-col', mask !== 'full' && `mask-${mask}`, props.tajweed && 'tj-on')}
        style={{ fontSize }}
      >
        {showBasmala && (
          <p className="quran mb-2 text-center text-green-deep" aria-label="Basmala">
            {props.basmala.map((w) => w.t).join(' ')}
          </p>
        )}
        {verses.map((v) => {
          const key = verseKey(meta.n, v.n)
          const active = highlight !== 'verse' && activeWord?.verse === key ? activeWord.position : null
          return (
            <div
              key={key}
              className="border-b border-border/60 py-[0.15em] last:border-0"
              style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${fontSize * 4}px` }}
            >
              <VerseText
                surah={meta.n}
                verse={v}
                verseActive={activeVerse === key}
                activeWord={active}
                selected={props.selectedVerse === key}
                tajweed={props.tajweed}
                ruleFilter={props.ruleFilter}
                mask={mask}
                wordClass={props.wordClass}
                onWordClick={props.onWordClick}
                onVerseNumberClick={props.onVerseNumberClick}
              />
            </div>
          )
        })}
        {highlight === 'letter' && <RangeLetterOverlay player={props.player} containerRef={containerRef} />}
      </div>
    </div>
  )
})

import { memo, useMemo } from 'react'
import { clustersWithJoiners, splitLetters } from '@/core/audio-sync/letters'
import { verseKey, wordId, type QuranVerse, type WordId } from '@/core/quran/types'

export interface VerseTextProps {
  surah: number
  verse: QuranVerse
  /** surlignage du verset entier */
  verseActive: boolean
  /** position du mot actif dans ce verset, ou null */
  activeWord: number | null
  /** découpe chaque mot en <span> par lettre (approche B) */
  splitClusters: boolean
  /** classes supplémentaires par mot (marquages, corrections…) */
  wordClass?: (id: WordId) => string | undefined
  onWordClick?: (id: WordId, event: React.MouseEvent) => void
}

/**
 * Un verset en mode lecture. Chaque mot porte `data-w="sourate:verset:position"` :
 * c'est l'ancre stable utilisée par le surlignage, les marquages et les corrections.
 * Le texte coranique est affiché tel quel, sans aucune transformation.
 */
export const VerseText = memo(function VerseText({
  surah,
  verse,
  verseActive,
  activeWord,
  splitClusters,
  wordClass,
  onWordClick,
}: VerseTextProps) {
  const key = verseKey(surah, verse.n)
  return (
    <div data-verse={key} className="quran relative">
      <span className={verseActive ? 'verse-hl' : undefined}>
        {verse.words.map((w) => {
          const id = wordId(surah, verse.n, w.p)
          const classes = [
            'cursor-pointer rounded-[0.2em] transition-colors duration-75',
            activeWord === w.p ? 'word-hl' : '',
            wordClass?.(id) ?? '',
          ].join(' ')
          return (
            <span key={w.p}>
              <span
                data-w={id}
                className={classes}
                onClick={onWordClick ? (e) => onWordClick(id, e) : undefined}
              >
                {splitClusters ? <ClusterSpans text={w.t} /> : w.t}
              </span>{' '}
            </span>
          )
        })}
        <span className="text-green-deep select-none" aria-label={`verset ${verse.n}`}>
          {verse.end.t}
        </span>
      </span>
    </div>
  )
})

/** Approche B : un <span> par lettre, avec des ZWJ là où les lettres se lient. */
export function ClusterSpans({ text, colored = false }: { text: string; colored?: boolean }) {
  const parts = useMemo(() => clustersWithJoiners(splitLetters(text)), [text])
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} data-c={i} style={colored ? { color: i % 2 ? '#b91c1c' : '#1d4ed8' } : undefined}>
          {p}
        </span>
      ))}
    </>
  )
}

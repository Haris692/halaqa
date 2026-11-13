import { memo, useMemo } from 'react'
import { clustersWithJoiners, splitLetters } from '@/core/audio-sync/letters'
import type { MaskLevel } from '@/core/memorization/memorization'
import { firstLetterEnd, wordSegments } from '@/core/quran/word-segments'
import { verseKey, wordId, type QuranVerse, type QuranWord, type VerseKey, type WordId } from '@/core/quran/types'
import { cn } from '@/lib/utils'

export interface VerseTextProps {
  surah: number
  verse: QuranVerse
  /** surlignage du verset entier */
  verseActive: boolean
  /** position du mot actif dans ce verset, ou null */
  activeWord: number | null
  /** verset sélectionné (panneau de traduction / tafsir) */
  selected?: boolean
  /** découpe chaque mot en <span> par lettre (labo 8.1, approche B) */
  splitClusters?: boolean
  /** coloration tajwid */
  tajweed?: boolean
  ruleFilter?: ((rule: string) => boolean) | undefined
  /** niveau de masquage (« première lettre » nécessite un découpage du mot) */
  mask?: MaskLevel
  /** classes supplémentaires par mot (marquages, corrections…) */
  wordClass?: ((id: WordId) => string | undefined) | undefined
  onWordClick?: ((id: WordId, event: React.MouseEvent) => void) | undefined
  onVerseNumberClick?: ((key: VerseKey) => void) | undefined
}

/**
 * Un verset en mode lecture. Chaque mot porte `data-w="sourate:verset:position"` :
 * c'est l'ancre stable utilisée par le surlignage, les marquages et les corrections.
 * Le texte coranique est affiché tel quel ; les seuls caractères ajoutés sont des
 * ZWJ invisibles aux frontières de couleur (voir word-segments.ts).
 */
export const VerseText = memo(function VerseText({
  surah,
  verse,
  verseActive,
  activeWord,
  selected = false,
  splitClusters = false,
  tajweed = false,
  ruleFilter,
  mask = 'full',
  wordClass,
  onWordClick,
  onVerseNumberClick,
}: VerseTextProps) {
  const key = verseKey(surah, verse.n)
  return (
    <div data-verse={key} className="quran relative">
      <span className={verseActive ? 'verse-hl' : undefined}>
        {verse.words.map((w, i) => {
          const id = wordId(surah, verse.n, w.p)
          // espace insécable après le dernier mot : le numéro du verset ne part jamais seul à la ligne
          const space = i === verse.words.length - 1 ? ' ' : ' '
          return (
            <span key={w.p}>
              <span
                data-w={id}
                className={cn('rounded-[0.2em]', onWordClick && 'cursor-pointer', activeWord === w.p && 'word-hl', wordClass?.(id))}
                onClick={onWordClick ? (e) => onWordClick(id, e) : undefined}
              >
                {splitClusters ? (
                  <ClusterSpans text={w.t} />
                ) : (
                  <WordContent word={w} tajweed={tajweed} ruleFilter={ruleFilter} firstLetter={mask === 'first'} />
                )}
              </span>
              {space}
            </span>
          )
        })}
        <button
          type="button"
          onClick={onVerseNumberClick ? () => onVerseNumberClick(key) : undefined}
          className={cn(
            'rounded-full text-green-deep select-none',
            selected && 'bg-gold-soft ring-2 ring-gold',
            !onVerseNumberClick && 'pointer-events-none',
          )}
          aria-label={`Verset ${verse.n}`}
          aria-pressed={selected}
        >
          {verse.end.t}
        </button>
      </span>
    </div>
  )
})

/** Contenu d'un mot : un seul nœud texte si rien à styliser, sinon des segments. */
export const WordContent = memo(function WordContent({
  word,
  tajweed,
  ruleFilter,
  firstLetter,
}: {
  word: QuranWord
  tajweed: boolean
  ruleFilter?: ((rule: string) => boolean) | undefined
  firstLetter: boolean
}) {
  const segments = useMemo(
    () =>
      wordSegments(word.t, {
        tajweed: tajweed ? word.r : undefined,
        ruleFilter,
        visibleEnd: firstLetter ? firstLetterEnd(word.t) : undefined,
      }),
    [word, tajweed, ruleFilter, firstLetter],
  )
  if (segments.length === 1 && !segments[0]!.rule && !segments[0]!.rest) return <>{word.t}</>
  return (
    <>
      {segments.map((s, i) => (
        <span key={i} className={cn(s.rule && `tj tj-${s.rule}`, s.rest && 'mask-rest')}>
          {s.text}
        </span>
      ))}
    </>
  )
})

/** Approche B (labo 8.1) : un <span> par lettre, avec des ZWJ là où les lettres se lient. */
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

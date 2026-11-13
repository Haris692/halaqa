import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { advanceTraining, backTraining, startTraining, type TrainingStep } from '@/core/memorization/memorization'
import { parseWordId, verseKey, type WordId } from '@/core/quran/types'
import { PlayerBar } from '@/features/player/PlayerBar'
import { useSurahPlayback } from '@/features/player/useSurahPlayback'
import { ReadingView } from '@/features/reader/ReadingView'
import { useSettings } from '@/features/settings/store'
import { flashReveal } from '@/lib/hooks'
import { useAsync } from '@/lib/useAsync'
import { loadMeta, loadSurah } from '@/services/quran-data'

/** Mode entraînement solo : écoute ×N → lecture à voix haute → récitation avec le texte masqué. */
export function TrainingPage() {
  const { t } = useTranslation('training')
  const navigate = useNavigate()
  const params = useParams()
  const [search] = useSearchParams()
  const surah = Math.min(114, Math.max(1, Number(params.surah) || 1))
  const data = useAsync(() => Promise.all([loadMeta(), loadSurah(surah), loadSurah(1)]), [surah])
  const s = useSettings()

  const count = data.status === 'ready' ? data.value[0][surah - 1]!.verses : 0
  const from = Math.max(1, Number(search.get('de')) || 1)
  const to = Math.min(count || Infinity, Math.max(from, Number(search.get('a')) || from))
  const listen = Math.max(1, Number(search.get('n')) || 3)

  const [state, setState] = useState(() => startTraining(listen))
  const [peek, setPeek] = useState(false)
  useEffect(() => {
    setState(startTraining(listen))
  }, [surah, from, to, listen])
  const step: TrainingStep = state.steps[state.index]!

  const playback = useSurahPlayback(surah, count, {
    repeatEach: step.kind === 'listen' ? step.repeat : 1,
    pauseAfter: 'none',
    range: [from - 1, to - 1],
  })
  const { player, snapshot } = playback

  const onWordClick = useCallback(
    (id: WordId, e: React.MouseEvent) => {
      if (step.kind === 'recite' && !peek) return flashReveal(e.currentTarget as HTMLElement)
      const w = parseWordId(id)
      player?.playWord(verseKey(w.surah, w.verse), w.position)
    },
    [player, step.kind, peek],
  )

  if (data.status !== 'ready') return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  const [meta, text, fatiha] = data.value
  const surahMeta = meta[surah - 1]!
  const mask = step.kind === 'recite' && !peek ? step.mask : 'full'
  const progress = state.done ? 100 : (state.index / state.steps.length) * 100

  const next = () => {
    player?.pause()
    setPeek(false)
    setState(advanceTraining)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-2 py-2">
          <Button asChild variant="ghost" size="icon-touch" aria-label={t('common:back')}>
            <Link to="/entrainement">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-green-deep">
              {surahMeta.translit} · {t('guided.range', { from, to })}
            </p>
            <Progress value={progress} className="mt-1 h-1.5" />
          </div>
        </div>
        <ol className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2 text-xs">
          {state.steps.map((st, i) => (
            <li
              key={i}
              className={`rounded-full px-2.5 py-1 whitespace-nowrap ${
                i === state.index && !state.done
                  ? 'bg-primary text-primary-foreground'
                  : i < state.index || state.done
                    ? 'bg-accent'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}. {stepLabel(t, st)}
            </li>
          ))}
        </ol>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4">
        {state.done ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Check className="size-12 text-green-deep" />
            <p className="text-lg font-medium">{t('guided.done')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="touch" onClick={() => setState(startTraining(listen))}>
                <RotateCcw /> {t('guided.again')}
              </Button>
              {to < count && (
                <Button
                  size="touch"
                  onClick={() => navigate(`/entrainement/sourate/${surah}?de=${to + 1}&a=${Math.min(count, to + 1 + (to - from))}&n=${listen}`)}
                >
                  {t('guided.nextPortion')} <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-gold/60 bg-card p-3 text-sm">
              <p className="font-medium">{stepLabel(t, step)}</p>
              <p className="text-muted-foreground">{t(`guided.instruction.${step.kind === 'recite' ? `recite_${step.mask}` : step.kind}`, { n: step.kind === 'listen' ? step.repeat : 0 })}</p>
            </div>
            <ReadingView
              meta={surahMeta}
              text={text}
              basmala={fatiha.verses[0]!.words}
              fontSize={s.fontSize}
              highlight={step.kind === 'recite' ? 'verse' : s.highlight}
              activeVerse={step.kind === 'recite' ? null : snapshot.activeVerse}
              activeWord={step.kind === 'recite' ? null : snapshot.activeWord}
              selectedVerse={null}
              player={player}
              tajweed={s.tajweed}
              mask={mask}
              verseRange={[from, to]}
              showHeader={false}
              onWordClick={onWordClick}
            />
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <Button variant="ghost" size="touch" onClick={() => setState(backTraining)} disabled={state.index === 0}>
                <ArrowLeft /> {t('guided.back')}
              </Button>
              {step.kind === 'recite' && (
                <Button variant="outline" size="touch" onClick={() => setPeek((p) => !p)}>
                  <Eye /> {peek ? t('guided.hide') : t('guided.peek')}
                </Button>
              )}
              <Button size="touch" onClick={next}>
                {state.index === state.steps.length - 1 ? t('guided.finish') : t('guided.next')} <ArrowRight />
              </Button>
            </div>
          </>
        )}
      </main>
      {!state.done && step.kind !== 'recite' && (
        <PlayerBar playback={playback} verseCount={count} startIndex={from - 1} compact />
      )}
    </div>
  )
}

function stepLabel(t: TFunction<'training'>, step: TrainingStep): string {
  if (step.kind === 'listen') return t('guided.step.listen', { n: step.repeat })
  if (step.kind === 'read') return t('guided.step.read')
  return t(`guided.step.recite_${step.mask}`)
}

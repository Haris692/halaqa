import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PauseAfterVerse, PlaybackSettings } from '@/core/audio-sync/playback'
import { SPEEDS } from '@/core/audio-sync/playback'
import { buildTimeline } from '@/core/audio-sync/timeline'
import { verseKey, type VerseKey, type WordId } from '@/core/quran/types'
import { RangeLetterOverlay, useClusterSpanHighlight } from '@/features/player/LetterHighlight'
import { useRecitationPlayer } from '@/features/player/useRecitationPlayer'
import { VerseText } from '@/features/reader/VerseText'
import { useAsync } from '@/lib/useAsync'
import { loadRecitation, loadSurah, type RecitationId } from '@/services/quran-data'
import { Button, Field, Panel, Segmented, Select, Slider } from '../ui'
import { JoiningBench } from './JoiningBench'

type Level = 'verse' | 'word' | 'letter'
type Approach = 'range' | 'spans'
type PauseChoice = 'none' | '2000' | '4000' | 'click'

const SURAHS = [1, 112] as const

function toPause(choice: PauseChoice): PauseAfterVerse {
  if (choice === 'none') return { kind: 'none' }
  if (choice === 'click') return { kind: 'click' }
  return { kind: 'timed', ms: Number(choice) }
}

export function HighlightLab() {
  const { t } = useTranslation('labs')
  const [surah, setSurah] = useState<(typeof SURAHS)[number]>(1)
  const [source, setSource] = useState<RecitationId>('husary-muallim-qdc')
  const [level, setLevel] = useState<Level>('letter')
  const [approach, setApproach] = useState<Approach>('range')
  const [fontSize, setFontSize] = useState(44)
  const [speed, setSpeed] = useState(1)
  const [repeatEach, setRepeatEach] = useState(1)
  const [pause, setPause] = useState<PauseChoice>('none')
  const [loop, setLoop] = useState(false)
  const [range, setRange] = useState<[number, number]>([0, 0])
  const [showBench, setShowBench] = useState(false)

  const data = useAsync(() => Promise.all([loadSurah(surah), loadRecitation(source, surah)]), [surah, source])
  const text = data.status === 'ready' ? data.value[0] : null
  const recitation = data.status === 'ready' ? data.value[1] : null

  const order = useMemo<VerseKey[]>(() => (text ? text.verses.map((v) => verseKey(surah, v.n)) : []), [text, surah])
  useEffect(() => setRange([0, Math.max(0, order.length - 1)]), [order.length])

  const timeline = useMemo(() => (recitation ? buildTimeline(recitation, order) : null), [recitation, order])
  const settings = useMemo<PlaybackSettings>(
    () => ({ rangeStart: range[0], rangeEnd: range[1], repeatEach, loopRange: loop, pauseAfterVerse: toPause(pause) }),
    [range, repeatEach, loop, pause],
  )
  const { player, snapshot } = useRecitationPlayer(timeline, order, settings)
  useEffect(() => player?.setSpeed(speed), [player, speed])

  const containerRef = useRef<HTMLDivElement>(null)
  const useSpans = level === 'letter' && approach === 'spans'
  useClusterSpanHighlight(player, containerRef, useSpans)

  // Affichage en direct du temps et de la lettre, sans re-rendu React
  const clockRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!player) return
    return player.onFrame(({ ms }) => {
      if (clockRef.current) clockRef.current.textContent = `${(ms / 1000).toFixed(2)} s`
    })
  }, [player])

  const onWordClick = useCallback(
    (id: WordId) => {
      const [s, v, p] = id.split(':')
      player?.playWord(`${Number(s)}:${Number(v)}`, Number(p))
    },
    [player],
  )

  const playButtons = (
    <>
      {snapshot.status === 'playing' ? (
        <Button onClick={() => player?.pause()}>{t('highlight.pause')}</Button>
      ) : snapshot.status === 'waiting' && snapshot.waitingFor === 'click' ? (
        <Button onClick={() => player?.continueAfterWait()}>{t('highlight.continue')}</Button>
      ) : (
        <Button onClick={() => player?.play()} disabled={!player}>
          {t('highlight.play')}
        </Button>
      )}
      <Button variant="ghost" onClick={() => player?.playFromVerse(range[0])} disabled={!player}>
        {t('highlight.restart')}
      </Button>
    </>
  )

  const verseOptions = order.map((k, i) => ({ value: i, label: k }))
  const showVerse = true
  const showWord = level !== 'verse'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-green-deep">{t('highlight.title')}</h1>
        <p className="text-sm text-ink/70">{t('highlight.intro')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel title={t('highlight.reader')}>
          {data.status === 'loading' && <p>{t('common:loading')}</p>}
          {data.status === 'error' && <p className="text-red-700">{t('common:loadError', { message: data.error.message })}</p>}
          {text && (
            <div ref={containerRef} className="relative flex flex-col gap-3" style={{ fontSize }}>
              {text.verses.map((v) => {
                const key = verseKey(surah, v.n)
                return (
                  <VerseText
                    key={key}
                    surah={surah}
                    verse={v}
                    verseActive={showVerse && snapshot.activeVerse === key}
                    activeWord={showWord && snapshot.activeWord?.verse === key ? snapshot.activeWord.position : null}
                    splitClusters={useSpans}
                    onWordClick={onWordClick}
                  />
                )
              })}
              {level === 'letter' && approach === 'range' && (
                <RangeLetterOverlay player={player} containerRef={containerRef} />
              )}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={t('highlight.playback')}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">{playButtons}</div>
              <p className="text-xs text-ink/60">{t('highlight.tapWord')}</p>
              <Field label={t('highlight.speed')}>
                <Segmented
                  value={speed}
                  options={SPEEDS.map((s) => ({ value: s, label: `${s.toLocaleString('fr-FR')}×` }))}
                  onChange={setSpeed}
                />
              </Field>
              <Field label={t('highlight.repeat')}>
                <Segmented value={repeatEach} options={[1, 2, 3, 5].map((n) => ({ value: n, label: `${n}×` }))} onChange={setRepeatEach} />
              </Field>
              <Field label={t('highlight.pauseAfter')}>
                <Select
                  value={pause}
                  onChange={setPause}
                  options={[
                    { value: 'none', label: t('highlight.pauseNone') },
                    { value: '2000', label: t('highlight.pauseSeconds', { n: 2 }) },
                    { value: '4000', label: t('highlight.pauseSeconds', { n: 4 }) },
                    { value: 'click', label: t('highlight.pauseClick') },
                  ]}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Field label={t('highlight.from')}>
                  <Select value={range[0]} options={verseOptions} onChange={(v) => setRange([v, Math.max(v, range[1])])} />
                </Field>
                <Field label={t('highlight.to')}>
                  <Select value={range[1]} options={verseOptions} onChange={(v) => setRange([Math.min(v, range[0]), v])} />
                </Field>
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                  {t('highlight.loop')}
                </label>
              </div>
            </div>
          </Panel>

          <Panel title={t('highlight.settings')}>
            <div className="flex flex-col gap-3">
              <Field label={t('highlight.surah')}>
                <Segmented
                  value={surah}
                  options={SURAHS.map((s) => ({ value: s, label: t(`highlight.surahName.${s}`) }))}
                  onChange={setSurah}
                />
              </Field>
              <Field label={t('highlight.source')}>
                <Select
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: 'husary-muallim-qdc', label: t('highlight.sourceQdc') },
                    { value: 'husary-muallim-cpfair', label: t('highlight.sourceCpfair') },
                  ]}
                />
              </Field>
              <Field label={t('highlight.level')}>
                <Segmented
                  value={level}
                  onChange={setLevel}
                  options={[
                    { value: 'verse', label: t('highlight.levelVerse') },
                    { value: 'word', label: t('highlight.levelWord') },
                    { value: 'letter', label: t('highlight.levelLetter') },
                  ]}
                />
              </Field>
              {level === 'letter' && (
                <Field label={t('highlight.approach')}>
                  <Segmented
                    value={approach}
                    onChange={setApproach}
                    options={[
                      { value: 'range', label: t('highlight.approachRange') },
                      { value: 'spans', label: t('highlight.approachSpans') },
                    ]}
                  />
                </Field>
              )}
              <Field label={t('highlight.fontSize', { px: fontSize })}>
                <Slider value={fontSize} min={24} max={96} onChange={setFontSize} />
              </Field>
            </div>
          </Panel>

          <Panel title={t('highlight.debug')}>
            <dl className="grid grid-cols-2 gap-1 font-mono text-xs">
              <dt>{t('highlight.dbgStatus')}</dt>
              <dd>{snapshot.status}{snapshot.waitingFor ? ` (${snapshot.waitingFor})` : ''}</dd>
              <dt>{t('highlight.dbgTime')}</dt>
              <dd>
                <span ref={clockRef}>–</span>
              </dd>
              <dt>{t('highlight.dbgVerse')}</dt>
              <dd>{snapshot.activeVerse ?? '–'}</dd>
              <dt>{t('highlight.dbgWord')}</dt>
              <dd>
                {snapshot.activeWord
                  ? `${snapshot.activeWord.position} (${snapshot.activeWord.start}–${snapshot.activeWord.end} ms)`
                  : '–'}
              </dd>
            </dl>
          </Panel>
        </div>
      </div>

      <Panel title={t('bench.title')}>
        <p className="mb-2 text-sm text-ink/70">{t('bench.intro')}</p>
        <Button variant="ghost" onClick={() => setShowBench((v) => !v)}>
          {showBench ? t('bench.hide') : t('bench.show')}
        </Button>
        {showBench && text && (
          <div className="mt-3">
            <JoiningBench text={text} fontSize={fontSize} />
          </div>
        )}
      </Panel>

      {/* Sur téléphone, les commandes sont sous le texte : barre de lecture toujours accessible */}
      <div className="sticky bottom-0 z-20 -mx-4 flex gap-2 border-t border-gold-soft bg-paper/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {playButtons}
      </div>
    </div>
  )
}

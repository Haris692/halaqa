import { Pause, Play, Repeat, Settings2, SkipBack, SkipForward, StepForward } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SPEEDS } from '@/core/audio-sync/playback'
import { parseVerseKey } from '@/core/quran/types'
import { useSettings, type HighlightLevel, type PauseChoice } from '@/features/settings/store'
import { Choice } from '@/features/ui/Choice'
import { useAsync } from '@/lib/useAsync'
import { loadReciters } from '@/services/quran-data'
import type { SurahPlayback } from './useSurahPlayback'

/**
 * Barre de lecture, toujours accessible en bas de l'écran. L'audio du
 * récitateur est joué localement sur l'appareil (jamais diffusé dans la visio).
 */
export function PlayerBar({
  playback,
  verseCount,
  startIndex,
  allowLetter = true,
  compact = false,
}: {
  playback: SurahPlayback
  verseCount: number
  /** verset par lequel commencer si rien n'est en cours (verset sélectionné) */
  startIndex: number
  /** surlignage lettre indisponible en Mushaf (polices à glyphes) */
  allowLetter?: boolean
  compact?: boolean
}) {
  const { t } = useTranslation('reader')
  const { player, snapshot, range, setRange, loop, setLoop } = playback
  // verset affiché : celui en cours, sinon celui par lequel la lecture commencera
  const current = snapshot.activeVerse
    ? parseVerseKey(snapshot.activeVerse).verse
    : snapshot.status === 'idle'
      ? Math.min(Math.max(startIndex, range[0]), range[1]) + 1
      : snapshot.verseIndex + 1

  const playPause = () => {
    if (!player) return
    if (snapshot.status === 'playing') return player.pause()
    if (snapshot.status === 'waiting') return player.continueAfterWait()
    if (snapshot.status === 'paused' && !snapshot.singleWord) return player.play()
    player.playFromVerse(Math.min(Math.max(startIndex, range[0]), range[1]))
  }
  const go = (delta: number) => {
    const idx = Math.min(verseCount - 1, Math.max(0, current - 1 + delta))
    player?.playFromVerse(idx)
  }

  const playing = snapshot.status === 'playing'
  const waitingClick = snapshot.status === 'waiting' && snapshot.waitingFor === 'click'

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-2 py-2 sm:gap-2">
        <Button variant="ghost" size="icon-touch" onClick={() => go(-1)} disabled={!player} aria-label={t('player.prev')}>
          <SkipBack />
        </Button>
        <Button size="touch" onClick={playPause} disabled={!player} className="min-w-28">
          {playing ? <Pause /> : waitingClick ? <StepForward /> : <Play />}
          {playing ? t('player.pause') : waitingClick ? t('player.continue') : t('player.play')}
        </Button>
        <Button variant="ghost" size="icon-touch" onClick={() => go(1)} disabled={!player} aria-label={t('player.next')}>
          <SkipForward />
        </Button>
        <span className="mx-1 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {snapshot.status === 'waiting' && snapshot.waitingFor === 'timer'
            ? t('player.yourTurn')
            : t('player.verseOf', { current, total: verseCount })}
        </span>
        <div className="ms-auto flex items-center gap-1">
          {!compact && <SpeedQuick />}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon-touch" aria-label={t('player.options')}>
                <Settings2 />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-[min(92vw,24rem)]">
              <PlayerOptions
                verseCount={verseCount}
                range={range}
                setRange={setRange}
                loop={loop}
                setLoop={setLoop}
                allowLetter={allowLetter}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

function SpeedQuick() {
  const speed = useSettings((s) => s.speed)
  const set = useSettings((s) => s.set)
  const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]!
  return (
    <Button variant="outline" size="touch" className="hidden px-3 tabular-nums sm:inline-flex" onClick={() => set({ speed: next })}>
      {speed.toLocaleString('fr-FR')}×
    </Button>
  )
}

function PlayerOptions({
  verseCount,
  range,
  setRange,
  loop,
  setLoop,
  allowLetter,
}: {
  verseCount: number
  range: [number, number]
  setRange: (r: [number, number]) => void
  loop: boolean
  setLoop: (v: boolean) => void
  allowLetter: boolean
}) {
  const { t } = useTranslation('reader')
  const s = useSettings()
  const reciters = useAsync(loadReciters, [])
  const verses = Array.from({ length: verseCount }, (_, i) => i)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground">{t('player.reciter')}</Label>
        <Select value={s.reciter} onValueChange={(reciter) => s.set({ reciter })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(reciters.status === 'ready' ? reciters.value : []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} — {r.style}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Choice
        label={t('player.speed')}
        value={s.speed}
        onChange={(speed) => s.set({ speed })}
        options={SPEEDS.map((v) => ({ value: v, label: `${v.toLocaleString('fr-FR')}×` }))}
      />
      <Choice
        label={t('player.highlight')}
        value={!allowLetter && s.highlight === 'letter' ? 'word' : s.highlight}
        onChange={(highlight: HighlightLevel) => s.set({ highlight })}
        options={[
          { value: 'verse', label: t('player.hlVerse') },
          { value: 'word', label: t('player.hlWord') },
          ...(allowLetter ? [{ value: 'letter' as const, label: t('player.hlLetter') }] : []),
        ]}
      />
      <Choice
        label={t('player.repeat')}
        value={s.repeatEach}
        onChange={(repeatEach) => s.set({ repeatEach })}
        options={[1, 2, 3, 5, 10].map((n) => ({ value: n, label: `${n}×` }))}
      />
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground">{t('player.pauseAfter')}</Label>
        <Select value={s.pauseAfter} onValueChange={(v) => s.set({ pauseAfter: v as PauseChoice })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('player.pauseNone')}</SelectItem>
            <SelectItem value="2000">{t('player.pauseSeconds', { n: 2 })}</SelectItem>
            <SelectItem value="4000">{t('player.pauseSeconds', { n: 4 })}</SelectItem>
            <SelectItem value="8000">{t('player.pauseSeconds', { n: 8 })}</SelectItem>
            <SelectItem value="click">{t('player.pauseClick')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-muted-foreground">{t('player.from')}</Label>
          <Select value={String(range[0])} onValueChange={(v) => setRange([Number(v), Math.max(Number(v), range[1])])}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {verses.map((i) => (
                <SelectItem key={i} value={String(i)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-muted-foreground">{t('player.to')}</Label>
          <Select value={String(range[1])} onValueChange={(v) => setRange([Math.min(Number(v), range[0]), Number(v)])}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {verses.map((i) => (
                <SelectItem key={i} value={String(i)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={loop} onCheckedChange={setLoop} />
          <Repeat className="size-4" /> {t('player.loop')}
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={s.autoScroll} onCheckedChange={(autoScroll) => s.set({ autoScroll })} />
        {t('player.autoScroll')}
      </label>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  countsBySurah,
  progressMap,
  rangeRows,
  SELF_STATUSES,
  statusOf,
  surahSummary,
  VERSE_STATUSES,
  type ProgressRow,
  type StatusCounts,
  type VerseStatus,
} from '@/core/progress/progress'
import type { SurahMeta } from '@/core/quran/types'
import { Choice } from '@/features/ui/Choice'
import { Notice } from '@/features/ui/PageShell'
import { errorMessage } from '@/features/auth/errors'
import { useQuery } from '@/lib/query'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/utils'
import { listProgress, setVerseStatus } from '@/services/accounts'
import { loadMeta } from '@/services/quran-data'

type Scope = 'amma' | 'all'
const AMMA_FIRST = 78

/**
 * Carte de progression d'un élève : une case par sourate, colorée selon les
 * statuts de ses versets ; toucher une sourate pour voir et changer ses versets.
 * Le prof peut tout marquer ; l'élève ne peut pas se marquer « acquis ».
 */
export function ProgressBoard({ studentId, editor }: { studentId: string; editor: 'teacher' | 'student' }) {
  const { t } = useTranslation('account')
  const meta = useAsync(loadMeta, [])
  const progress = useQuery(`progress:${studentId}`, () => listProgress(studentId))
  const [scope, setScope] = useState<Scope>('amma')
  const [open, setOpen] = useState<number | null>(null)

  const rows = progress.status === 'ready' ? progress.value : null
  const counts = useMemo(
    () => (meta.status === 'ready' && rows ? countsBySurah(rows, meta.value.map((m) => m.verses)) : null),
    [meta, rows],
  )

  if (meta.status === 'error') return <Notice tone="error">{meta.error.message}</Notice>
  if (progress.status === 'error') return <Notice tone="error">{errorMessage(t, progress.error)}</Notice>
  if (meta.status !== 'ready' || !counts || !rows) return <p className="text-muted-foreground">{t('common:loading')}</p>

  // Juz 'Amma dans l'ordre habituel d'apprentissage : d'An-Nâs vers An-Naba'
  const surahs = scope === 'all' ? meta.value : meta.value.filter((m) => m.n >= AMMA_FIRST).reverse()
  const totals = counts.reduce(
    (acc, c) => ({ learning: acc.learning + c.learning, acquired: acc.acquired + c.acquired, review: acc.review + c.review }),
    { learning: 0, acquired: 0, review: 0 },
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Choice
          value={scope}
          onChange={setScope}
          options={[
            { value: 'amma', label: t('progress.amma') },
            { value: 'all', label: t('progress.all') },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          {t('progress.totals', { acquired: totals.acquired, learning: totals.learning, review: totals.review })}
        </p>
      </div>
      <Legend />
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
        {surahs.map((m) => (
          <li key={m.n}>
            <SurahCell meta={m} counts={counts[m.n - 1]!} onOpen={() => setOpen(m.n)} />
          </li>
        ))}
      </ul>
      {open !== null && (
        <SurahSheet
          meta={meta.value[open - 1]!}
          rows={rows}
          studentId={studentId}
          editor={editor}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

export function Legend() {
  const { t } = useTranslation('account')
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {VERSE_STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn('inline-block size-3 rounded-sm', `st-${s}`)} /> {t(`status.${s}`)}
        </li>
      ))}
    </ul>
  )
}

function SurahCell({ meta, counts, onOpen }: { meta: SurahMeta; counts: StatusCounts; onOpen: () => void }) {
  const { t } = useTranslation('account')
  const summary = surahSummary(counts)
  const total = meta.verses
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border border-border p-2 text-start transition-colors hover:border-green-deep',
        summary === 'acquired' && 'st-acquired',
      )}
      aria-label={t('progress.cellLabel', { name: meta.translit, acquired: counts.acquired, total })}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="truncate text-sm font-medium">
          {meta.n}. {meta.translit}
        </span>
      </span>
      <span className="flex h-2 overflow-hidden rounded-full st-new" aria-hidden>
        {(['acquired', 'learning', 'review'] as const).map((s) =>
          counts[s] > 0 ? <span key={s} className={`st-${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null,
        )}
      </span>
      <span className="text-xs opacity-80">
        {counts.acquired}/{total}
      </span>
    </button>
  )
}

function SurahSheet({
  meta,
  rows,
  studentId,
  editor,
  onClose,
}: {
  meta: SurahMeta
  rows: readonly ProgressRow[]
  studentId: string
  editor: 'teacher' | 'student'
  onClose: () => void
}) {
  const { t } = useTranslation('account')
  const map = useMemo(() => progressMap(rows), [rows])
  const [range, setRange] = useState<[number, number] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const allowed = editor === 'teacher' ? VERSE_STATUSES : SELF_STATUSES
  const verses = Array.from({ length: meta.verses }, (_, i) => i + 1)

  const tap = (ayah: number) => {
    setError(null)
    if (!range || range[0] !== range[1]) setRange([ayah, ayah])
    else setRange([Math.min(range[0], ayah), Math.max(range[0], ayah)])
  }
  const apply = async (status: VerseStatus) => {
    const [from, to] = range ?? [1, meta.verses]
    setBusy(true)
    try {
      await setVerseStatus(studentId, rangeRows(meta.n, from, to, status))
      setRange(null)
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }
  const selected = (ayah: number) => range !== null && ayah >= range[0] && ayah <= range[1]

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>
            {meta.n}. {meta.translit} <span className="quran ms-1 text-xl" lang="ar">{meta.ar}</span>
          </SheetTitle>
          <SheetDescription>{t('progress.sheetHint')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <ul className="flex flex-wrap gap-1.5">
            {verses.map((ayah) => {
              const st = statusOf(map, meta.n, ayah)
              return (
                <li key={ayah}>
                  <button
                    type="button"
                    onClick={() => tap(ayah)}
                    aria-pressed={selected(ayah)}
                    title={t(`status.${st}`)}
                    className={cn(
                      'size-10 rounded-md text-sm tabular-nums transition-shadow',
                      `st-${st}`,
                      selected(ayah) && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                    )}
                  >
                    {ayah}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-sm text-muted-foreground">
            {range
              ? range[0] === range[1]
                ? t('progress.selectedOne', { n: range[0] })
                : t('progress.selectedRange', { from: range[0], to: range[1] })
              : t('progress.selectedNone')}
          </p>
          <div className="flex flex-wrap gap-2">
            {allowed.map((s) => (
              <Button key={s} variant="outline" size="touch" disabled={busy} onClick={() => apply(s)} className="gap-2">
                <span className={cn('inline-block size-3 rounded-sm', `st-${s}`)} /> {t(`status.${s}`)}
              </Button>
            ))}
          </div>
          {editor === 'student' && <p className="text-xs text-muted-foreground">{t('progress.studentHint')}</p>}
          {error && <Notice tone="error">{error}</Notice>}
          <Button asChild variant="ghost" className="self-start">
            <Link to={`/lire/${meta.n}`}>{t('progress.openReader')}</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

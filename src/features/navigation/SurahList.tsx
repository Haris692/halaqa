import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { searchSurahs } from '@/core/quran/search'
import type { SurahMeta } from '@/core/quran/types'
import { cn } from '@/lib/utils'

/** Recherche par numéro, nom arabe, nom français ou translittération, puis liste des sourates. */
export function SurahList({
  meta,
  onPick,
  current,
  autoFocus = false,
  className,
}: {
  meta: readonly SurahMeta[]
  onPick: (surah: number) => void
  current?: number
  autoFocus?: boolean
  className?: string
}) {
  const { t } = useTranslation('reader')
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSurahs(meta, query), [meta, query])
  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('nav.searchPlaceholder')}
          className="h-11 ps-9 text-base"
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) onPick(results[0].n)
          }}
          aria-label={t('nav.search')}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {results.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              onClick={() => onPick(s.n)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-muted',
                current === s.n && 'bg-accent',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/60 text-sm tabular-nums">
                {s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.translit}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {s.fr} · {t('versesCount', { count: s.verses })}
                </span>
              </span>
              <span className="quran shrink-0 text-xl leading-none text-green-deep">{s.ar}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="p-3 text-sm text-muted-foreground">{t('nav.noResult')}</li>}
      </ul>
    </div>
  )
}

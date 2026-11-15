import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { parseWordId } from '@/core/quran/types'
import { errorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'
import { errorSummary, type ErrorSummary } from '@/services/tools'
import { useLive } from './store'

/**
 * Erreurs les plus fréquentes de la séance (retour commun), agrégées à partir des
 * corrections confirmées. Anonymes : aucun nom d'élève n'apparaît.
 */
export function ErrorSummaryCard({ sessionId, compact = false }: { sessionId: string; compact?: boolean }) {
  const { t } = useTranslation('live')
  const navigate = useNavigate()
  const [data, setData] = useState<ErrorSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  // recalculé à chaque changement de la séance (ex. retour en salle principale)
  const version = useLive((s) => s.state)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    errorSummary(sessionId).then(
      (d) => alive && (setData(d), setError(null)),
      (e: unknown) => alive && setError(errorMessage(t, e)),
    )
    return () => {
      alive = false
    }
  }, [sessionId, tick, version, t])

  return (
    <section className={cn('flex flex-col gap-2', compact ? 'border-t border-border px-3 py-2' : '')} aria-label={t('summary.title')}>
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold">{t('summary.title')}</h3>
        <Button variant="ghost" size="icon" onClick={() => setTick((n) => n + 1)} aria-label={t('summary.refresh')}>
          <RefreshCw />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {data && data.total === 0 && <p className="text-sm text-muted-foreground">{t('summary.empty')}</p>}
      {data && data.total > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{t('summary.total', { count: data.total })}</p>
          <ul className="flex flex-col gap-1">
            {data.by_type.map((x) => (
              <li key={`${x.error_type}-${x.tajweed_rule ?? ''}`} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  {t(`errorTypes.${x.error_type}`)}
                  {x.tajweed_rule && ` — ${t(`tajweedRules.${x.tajweed_rule}`, { defaultValue: x.tajweed_rule })}`}
                </span>
                <span className="rounded-full bg-destructive/15 px-2 text-xs font-semibold tabular-nums text-destructive">{x.count}</span>
              </li>
            ))}
          </ul>
          {!compact && data.by_word.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">{t('summary.byWord')}</p>
              <div className="flex flex-wrap gap-1.5">
                {data.by_word.map((w) => {
                  const { surah, verse } = parseWordId(w.word)
                  return (
                    <button
                      key={w.word}
                      type="button"
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => navigate(`/lire/${surah}?v=${verse}`)}
                      title={t('summary.open')}
                    >
                      {w.word} · {w.count} ({t('summary.students', { count: w.students })})
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

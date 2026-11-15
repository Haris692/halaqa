import { Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/store'
import { useQuery } from '@/lib/query'
import { liveNow } from '@/services/live'
import { useLive } from './store'

/** Bandeau de l'accueil : une séance de mes classes est en cours. */
export function LiveBanner() {
  const { t } = useTranslation('live')
  const signedIn = useAuth((s) => s.status === 'signedIn')
  const current = useQuery(signedIn ? 'sessions:live' : null, liveNow)
  const joinedId = useLive((s) => s.sessionId)
  if (current.status !== 'ready' || current.value.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {current.value.map((s) => (
        <Link
          key={s.id}
          to={`/seance/${s.id}`}
          className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 hover:bg-destructive/15"
        >
          <Radio className="size-5 text-destructive" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t('banner.live', { name: s.classes?.name ?? '' })}</span>
            <span className="block truncate text-sm text-muted-foreground">{s.title}</span>
          </span>
          <span className="font-medium text-destructive">{joinedId === s.id ? t('banner.back') : t('banner.join')}</span>
        </Link>
      ))}
    </div>
  )
}

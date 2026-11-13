import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import type { AppRole } from '@/services/supabase'
import { Notice, PageShell } from '@/features/ui/PageShell'
import { useAuth } from './store'

/** Réserve une page aux comptes connectés (et éventuellement à certains rôles). */
export function RequireAuth({ roles, children }: { roles?: readonly AppRole[]; children: ReactNode }) {
  const { t } = useTranslation('account')
  const location = useLocation()
  const status = useAuth((s) => s.status)
  const profile = useAuth((s) => s.profile)

  if (status === 'disabled') {
    return (
      <PageShell title={t('title')}>
        <Notice>{t('disabled')}</Notice>
      </PageShell>
    )
  }
  if (status === 'loading' || (status === 'signedIn' && !profile)) {
    return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  }
  if (status === 'signedOut') {
    return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  if (roles && profile && !roles.includes(profile.role)) {
    return (
      <PageShell title={t('forbiddenTitle')}>
        <Notice tone="error">{t('errors.forbidden')}</Notice>
      </PageShell>
    )
  }
  return <>{children}</>
}

/** Destination après connexion : seulement un chemin interne (pas de redirection ouverte). */
export function safeNext(value: string | null, fallback = '/'): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

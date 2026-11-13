import { BarChart3, GraduationCap, LogIn, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { isStaff, useAuth } from './store'

/** Bouton d'en-tête : « Se connecter » ou le nom du compte. Absent sans Supabase. */
export function AccountButton() {
  const { t } = useTranslation('account')
  const status = useAuth((s) => s.status)
  const profile = useAuth((s) => s.profile)
  if (status === 'disabled' || status === 'loading') return null
  if (status === 'signedOut') {
    return (
      <Button asChild variant="ghost" size="touch" className="px-3">
        <Link to="/connexion">
          <LogIn /> <span className="hidden sm:inline">{t('login.short')}</span>
        </Link>
      </Button>
    )
  }
  return (
    <Button asChild variant="ghost" size="touch" className="max-w-44 px-3">
      <Link to="/compte" aria-label={t('title')}>
        <UserRound /> <span className="hidden truncate sm:inline">{profile?.display_name}</span>
      </Link>
    </Button>
  )
}

/** Raccourcis de l'accueil selon le rôle. */
export function AccountHomeLinks() {
  const { t } = useTranslation('account')
  const profile = useAuth((s) => s.profile)
  if (!profile) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {isStaff(profile) && (
        <Button asChild size="touch" className="h-14 justify-start">
          <Link to="/prof">
            <GraduationCap /> {t('teacherSpace')}
          </Link>
        </Button>
      )}
      {profile.role === 'admin' && (
        <Button asChild variant="outline" size="touch" className="h-14 justify-start">
          <Link to="/admin">
            <ShieldCheck /> {t('adminSpace')}
          </Link>
        </Button>
      )}
      {profile.role === 'student' && (
        <Button asChild size="touch" className="h-14 justify-start sm:col-span-2">
          <Link to="/progression">
            <BarChart3 /> {t('myProgress')}
          </Link>
        </Button>
      )}
    </div>
  )
}

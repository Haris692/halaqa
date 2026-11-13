import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Cadre des pages hors lecteur : bouton retour, titre, contenu centré. */
export function PageShell({
  title,
  back = '/',
  actions,
  children,
  wide = false,
}: {
  title: ReactNode
  back?: string
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('mx-auto flex min-h-dvh flex-col gap-4 p-4', wide ? 'max-w-5xl' : 'max-w-3xl')}>
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-touch" aria-label={t('back')}>
          <Link to={back}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold text-green-deep">{title}</h1>
        {actions}
      </header>
      {children}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-green-deep/30 bg-green-deep/10 text-green-deep',
        tone === 'info' && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {children}
    </p>
  )
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Champ de saisie confortable au doigt. */
export const inputClass = 'h-11 text-base md:text-base'

import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export function LabsHome() {
  const { t } = useTranslation('labs')
  const labs = [
    { to: '/labs/surlignage', title: t('home.highlightTitle'), text: t('home.highlightText') },
    { to: '/labs/crayon?role=prof', title: t('home.penTitle'), text: t('home.penText') },
  ]
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold text-green-deep">{t('home.title')}</h1>
      <p className="text-ink/70">{t('home.intro')}</p>
      {labs.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="rounded-xl border border-gold-soft bg-white/60 p-4 shadow-sm transition hover:border-gold hover:bg-white"
        >
          <h2 className="font-semibold text-green-deep">{l.title}</h2>
          <p className="text-sm text-ink/70">{l.text}</p>
        </Link>
      ))}
      <p className="text-xs text-ink/50">{t('home.credits')}</p>
    </main>
  )
}

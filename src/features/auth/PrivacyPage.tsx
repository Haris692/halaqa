import { useTranslation } from 'react-i18next'
import { PageShell } from '@/features/ui/PageShell'

/** Page « confidentialité » : données minimales, ce qui est stocké, suppression. */
export function PrivacyPage() {
  const { t } = useTranslation('account')
  const sections = t('privacy.sections', { returnObjects: true }) as { title: string; text: string }[]
  return (
    <PageShell title={t('privacy.title')}>
      <p className="text-sm text-muted-foreground">{t('privacy.updated')}</p>
      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-1">
          <h2 className="font-semibold text-green-deep">{s.title}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{s.text}</p>
        </section>
      ))}
    </PageShell>
  )
}

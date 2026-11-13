import { BookOpen, FlaskConical, GraduationCap, Navigation, PlayCircle, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { pageOfVerse } from '@/core/quran/navigation'
import { parseVerseKey } from '@/core/quran/types'
import { GoToDialog } from '@/features/navigation/GoToDialog'
import { SurahList } from '@/features/navigation/SurahList'
import { SettingsSheet } from '@/features/settings/SettingsSheet'
import { useProgress, useSettings } from '@/features/settings/store'
import { useAsync } from '@/lib/useAsync'
import { loadIndex, loadMeta } from '@/services/quran-data'

export function HomePage() {
  const { t } = useTranslation('reader')
  const navigate = useNavigate()
  const mode = useSettings((s) => s.mode)
  const last = useProgress((p) => p.last)
  const data = useAsync(() => Promise.all([loadMeta(), loadIndex()]), [])
  const [settings, setSettings] = useState(false)
  const [goTo, setGoTo] = useState(false)

  if (data.status !== 'ready') {
    return <div className="p-6 text-muted-foreground">{data.status === 'error' ? data.error.message : t('common:loading')}</div>
  }
  const [meta, index] = data.value
  const open = (surah: number, verse = 1) =>
    navigate(mode === 'mushaf' ? `/page/${pageOfVerse(index, `${surah}:${verse}`)}` : `/lire/${surah}${verse > 1 ? `?v=${verse}` : ''}`)
  const lastPos = last ? parseVerseKey(last) : null

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-green-deep">{t('common:appName')}</h1>
          <p className="text-sm text-muted-foreground">{t('common:tagline')}</p>
        </div>
        <Button variant="ghost" size="icon-touch" onClick={() => setSettings(true)} aria-label={t('toolbar.settings')}>
          <Settings />
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {lastPos && (
          <Card className="sm:col-span-2">
            <CardContent className="flex items-center gap-3">
              <PlayCircle className="size-8 shrink-0 text-green-deep" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{t('home.resume')}</p>
                <p className="truncate font-medium">
                  {meta[lastPos.surah - 1]!.translit} — {t('home.verse', { n: lastPos.verse })}
                </p>
              </div>
              <Button size="touch" onClick={() => open(lastPos.surah, lastPos.verse)}>
                {t('home.continue')}
              </Button>
            </CardContent>
          </Card>
        )}
        <Button variant="outline" size="touch" className="h-14 justify-start" onClick={() => navigate('/page/1')}>
          <BookOpen /> {t('home.openMushaf')}
        </Button>
        <Button variant="outline" size="touch" className="h-14 justify-start" onClick={() => setGoTo(true)}>
          <Navigation /> {t('home.goTo')}
        </Button>
        <Button asChild variant="outline" size="touch" className="h-14 justify-start sm:col-span-2">
          <Link to="/entrainement">
            <GraduationCap /> {t('home.training')}
          </Link>
        </Button>
      </div>

      <section className="flex min-h-[28rem] flex-1 flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t('home.surahs')}</h2>
        <SurahList meta={meta} onPick={(s) => open(s)} className="flex-1" />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{t('home.credits')}</span>
        <Link to="/labs" className="inline-flex items-center gap-1 underline">
          <FlaskConical className="size-3" /> {t('home.labs')}
        </Link>
      </footer>
      <SettingsSheet open={settings} onOpenChange={setSettings} />
      <GoToDialog open={goTo} onOpenChange={setGoTo} meta={meta} index={index} />
    </div>
  )
}

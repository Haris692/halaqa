import { ArrowLeft, Dices, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProgress } from '@/features/settings/store'
import { Choice } from '@/features/ui/Choice'
import { useAsync } from '@/lib/useAsync'
import { loadMeta } from '@/services/quran-data'

const JUZ_AMMA = Array.from({ length: 37 }, (_, i) => 78 + i)

export function TrainingHubPage() {
  const { t } = useTranslation('training')
  const navigate = useNavigate()
  const meta = useAsync(loadMeta, [])
  const { learned, toggleLearned, setLearned } = useProgress()
  const [surah, setSurah] = useState(1)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(7)
  const [listen, setListen] = useState(3)

  if (meta.status !== 'ready') return <div className="p-6 text-muted-foreground">{t('common:loading')}</div>
  const all = meta.value
  const count = all[surah - 1]!.verses
  const verseOptions = Array.from({ length: count }, (_, i) => i + 1)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-touch" aria-label={t('common:back')}>
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-green-deep">{t('hub.title')}</h1>
      </header>
      <p className="text-sm text-muted-foreground">{t('hub.intro')}</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-green-deep" /> {t('hub.guidedTitle')}
          </CardTitle>
          <CardDescription>{t('hub.guidedText')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">{t('hub.surah')}</Label>
            <Select
              value={String(surah)}
              onValueChange={(v) => {
                const n = Number(v)
                setSurah(n)
                setFrom(1)
                setTo(Math.min(all[n - 1]!.verses, 7))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {all.map((s) => (
                  <SelectItem key={s.n} value={String(s.n)}>
                    {s.n}. {s.translit} — {s.fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3">
            <VerseSelect label={t('hub.from')} value={from} options={verseOptions} onChange={(v) => (setFrom(v), setTo(Math.max(v, to)))} />
            <VerseSelect label={t('hub.to')} value={to} options={verseOptions} onChange={(v) => (setTo(v), setFrom(Math.min(v, from)))} />
          </div>
          <Choice
            label={t('hub.listenCount')}
            value={listen}
            onChange={setListen}
            options={[1, 3, 5, 7].map((n) => ({ value: n, label: `${n}×` }))}
          />
          <Button size="touch" onClick={() => navigate(`/entrainement/sourate/${surah}?de=${from}&a=${to}&n=${listen}`)}>
            {t('hub.start')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="size-5 text-green-deep" /> {t('hub.continueTitle')}
          </CardTitle>
          <CardDescription>{t('hub.continueText')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLearned([...learned, ...JUZ_AMMA])}>
              {t('hub.addJuzAmma')}
            </Button>
            <Button variant="outline" onClick={() => setLearned([...learned, 1])}>
              {t('hub.addFatiha')}
            </Button>
            <Button variant="ghost" onClick={() => setLearned([])} disabled={!learned.length}>
              {t('hub.clear')}
            </Button>
          </div>
          <ul className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
            {all.map((s) => (
              <li key={s.n}>
                <label className="flex min-h-10 items-center gap-2 rounded px-2 hover:bg-muted">
                  <Checkbox checked={learned.includes(s.n)} onCheckedChange={() => toggleLearned(s.n)} />
                  <span className="text-sm">
                    {s.n}. {s.translit}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button size="touch" disabled={!learned.length} onClick={() => navigate('/entrainement/continuer')}>
            {t('hub.continueStart', { count: learned.length })}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function VerseSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

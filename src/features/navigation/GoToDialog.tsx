import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { clampPage, divisionStart, PAGE_COUNT, pageOfVerse, type Division } from '@/core/quran/navigation'
import { parseVerseKey, type QuranIndex, type SurahMeta } from '@/core/quran/types'
import { useSettings } from '@/features/settings/store'
import { SurahList } from './SurahList'

/** Aller à une sourate, un juz, un hizb ou une page. */
export function GoToDialog({
  open,
  onOpenChange,
  meta,
  index,
  currentSurah,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  meta: readonly SurahMeta[]
  index: QuranIndex
  currentSurah?: number
}) {
  const { t } = useTranslation('reader')
  const navigate = useNavigate()
  const mode = useSettings((s) => s.mode)
  const [page, setPage] = useState('')

  const goVerse = (key: string) => {
    onOpenChange(false)
    const { surah, verse } = parseVerseKey(key as `${number}:${number}`)
    if (mode === 'mushaf') {
      navigate(`/page/${pageOfVerse(index, `${surah}:${verse}`)}`)
    } else {
      navigate(`/lire/${surah}?v=${verse}`)
    }
  }
  const division = (d: Division, n: number) => {
    const key = divisionStart(index, d, n)
    if (key) goVerse(key)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85dvh] max-h-[44rem] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('nav.goTo')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="surah" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="surah">{t('nav.surah')}</TabsTrigger>
            <TabsTrigger value="juz">{t('nav.juz')}</TabsTrigger>
            <TabsTrigger value="hizb">{t('nav.hizb')}</TabsTrigger>
            <TabsTrigger value="page">{t('nav.page')}</TabsTrigger>
          </TabsList>
          <TabsContent value="surah" className="flex min-h-0 flex-1 flex-col">
            <SurahList meta={meta} onPick={(s) => goVerse(`${s}:1`)} {...(currentSurah ? { current: currentSurah } : {})} autoFocus className="flex-1" />
          </TabsContent>
          <TabsContent value="juz" className="overflow-y-auto">
            <NumberGrid count={30} onPick={(n) => division('juz', n)} />
          </TabsContent>
          <TabsContent value="hizb" className="overflow-y-auto">
            <NumberGrid count={60} onPick={(n) => division('hizb', n)} />
          </TabsContent>
          <TabsContent value="page">
            <form
              className="flex items-end gap-2 pt-2"
              onSubmit={(e) => {
                e.preventDefault()
                const n = Number(page)
                if (!Number.isFinite(n) || n < 1) return
                onOpenChange(false)
                navigate(mode === 'mushaf' ? `/page/${clampPage(n)}` : `/lire/${index.pages[clampPage(n) - 1]!.first.replace(':', '?v=')}`)
              }}
            >
              <Input
                inputMode="numeric"
                value={page}
                onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))}
                placeholder={t('nav.pagePlaceholder', { max: PAGE_COUNT })}
                className="h-11 text-base"
              />
              <Button type="submit" size="touch">
                {t('nav.go')}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function NumberGrid({ count, onPick }: { count: number; onPick: (n: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2 py-2 sm:grid-cols-6">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <Button key={n} variant="outline" size="touch" onClick={() => onPick(n)} className="tabular-nums">
          {n}
        </Button>
      ))}
    </div>
  )
}

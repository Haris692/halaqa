import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SurahMeta, TextSource, VerseCommentary } from '@/core/quran/types'
import { useSettings } from '@/features/settings/store'
import { useAsync } from '@/lib/useAsync'
import { loadSources, loadTafsir, loadTranslation } from '@/services/quran-data'

/**
 * Traduction du sens et tafsir du verset sélectionné (ou en cours de lecture).
 * La source est toujours affichée sous le texte.
 */
export function CommentaryPanel({ meta, verse }: { meta: SurahMeta; verse: number }) {
  const { t } = useTranslation('reader')
  const s = useSettings()
  const sources = useAsync(loadSources, [])
  const translation = useAsync(() => loadTranslation(s.translation, meta.n), [s.translation, meta.n])
  const tafsir = useAsync(() => loadTafsir(s.tafsir, meta.n), [s.tafsir, meta.n])
  const list = sources.status === 'ready' ? sources.value : { translations: [], tafsirs: [] }

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-sm font-medium text-green-deep">{t('commentary.verseTitle', { surah: meta.translit, verse })}</p>
      <Tabs value={s.panelTab} onValueChange={(v) => s.set({ panelTab: v as 'translation' | 'tafsir' })} className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="translation">{t('commentary.translation')}</TabsTrigger>
          <TabsTrigger value="tafsir">{t('commentary.tafsir')}</TabsTrigger>
        </TabsList>
        <TabsContent value="translation" className="flex flex-col gap-3">
          <SourceSelect value={s.translation} options={list.translations} onChange={(translation) => s.set({ translation })} />
          <CommentaryText
            state={translation}
            verse={verse}
            source={list.translations.find((x) => x.key === s.translation)}
          />
        </TabsContent>
        <TabsContent value="tafsir" className="flex flex-col gap-3">
          <SourceSelect value={s.tafsir} options={list.tafsirs} onChange={(tafsir) => s.set({ tafsir })} />
          <CommentaryText state={tafsir} verse={verse} source={list.tafsirs.find((x) => x.key === s.tafsir)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SourceSelect({ value, options, onChange }: { value: string; options: TextSource[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CommentaryText({
  state,
  verse,
  source,
}: {
  state: ReturnType<typeof useAsync<Record<string, VerseCommentary>>>
  verse: number
  source: TextSource | undefined
}) {
  const { t } = useTranslation('reader')
  if (state.status === 'loading') return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
  if (state.status === 'error') return <p className="text-sm text-destructive">{t('common:loadError', { message: state.error.message })}</p>
  const item = state.value[String(verse)]
  const arabic = source?.lang === 'ar'
  return (
    <article className="flex flex-col gap-3">
      {item?.g && <p className="text-xs text-muted-foreground">{t('commentary.group', { from: item.g[0], to: item.g[1] })}</p>}
      <p
        dir={arabic ? 'rtl' : 'ltr'}
        className={arabic ? 'text-xl leading-loose' : 'text-base leading-relaxed'}
        lang={arabic ? 'ar' : 'fr'}
      >
        {item?.t ?? t('commentary.missing')}
      </p>
      {item?.f && (
        <p className="border-s-2 border-gold/60 ps-3 text-sm whitespace-pre-line text-muted-foreground">{item.f}</p>
      )}
      {source && (
        <footer className="border-t border-border pt-2 text-xs text-muted-foreground">
          {t('commentary.source')} : {source.title} — {source.author} ({source.source}){' '}
          <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
            <ExternalLink className="size-3" />
          </a>
          {source.note && <span className="block italic">{source.note}</span>}
        </footer>
      )}
    </article>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { clampPage, PAGE_COUNT, pageOfVerse } from '@/core/quran/navigation'
import { parseVerseKey, parseWordId, verseKey, type VerseKey, type WordId } from '@/core/quran/types'
import { ruleFilterFor } from '@/core/tajweed/rules'
import { PlayerBar } from '@/features/player/PlayerBar'
import { useSurahPlayback } from '@/features/player/useSurahPlayback'
import { MushafPageView } from '@/features/reader/MushafPageView'
import { ReaderLayout } from '@/features/reader/ReaderLayout'
import { ReadingView } from '@/features/reader/ReadingView'
import { useProgress, useSettings, type ReaderMode } from '@/features/settings/store'
import { flashReveal, useElementWidth, usePinch, useSwipe } from '@/lib/hooks'
import { useAsync } from '@/lib/useAsync'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { loadIndex, loadMeta, loadPage, loadSurah } from '@/services/quran-data'

const clampSurah = (n: number) => Math.min(114, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1))

function useFontPinch(ref: React.RefObject<HTMLElement | null>) {
  const fontSize = useSettings((s) => s.fontSize)
  const set = useSettings((s) => s.set)
  const base = useRef(fontSize)
  usePinch(ref, (factor, phase) => {
    if (phase === 'start') base.current = useSettings.getState().fontSize
    else set({ fontSize: base.current * factor })
  })
  return fontSize
}

function Loading({ error }: { error?: Error | null }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-muted-foreground">
      {error ? t('loadError', { message: error.message }) : t('loading')}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode lecture : /lire/:surah?v=verset
// ---------------------------------------------------------------------------

export function SurahReaderPage() {
  const params = useParams()
  const [search] = useSearchParams()
  const surah = clampSurah(Number(params.surah))
  const targetVerse = Number(search.get('v') ?? 0)
  const data = useAsync(() => Promise.all([loadMeta(), loadIndex(), loadSurah(surah), loadSurah(1)]), [surah])
  if (data.status !== 'ready') return <Loading error={data.status === 'error' ? data.error : null} />
  const [meta, index, text, fatiha] = data.value
  return (
    <SurahReader
      key={surah}
      surah={surah}
      targetVerse={targetVerse}
      meta={meta}
      index={index}
      text={text}
      basmala={fatiha.verses[0]!.words}
    />
  )
}

function SurahReader({
  surah,
  targetVerse,
  meta,
  index,
  text,
  basmala,
}: {
  surah: number
  targetVerse: number
  meta: Awaited<ReturnType<typeof loadMeta>>
  index: Awaited<ReturnType<typeof loadIndex>>
  text: Awaited<ReturnType<typeof loadSurah>>
  basmala: Awaited<ReturnType<typeof loadSurah>>['verses'][number]['words']
}) {
  const { t } = useTranslation('reader')
  const navigate = useNavigate()
  const s = useSettings()
  const setLast = useProgress((p) => p.setLast)
  const surahMeta = meta[surah - 1]!
  const mainRef = useRef<HTMLElement>(null)
  const fontSize = useFontPinch(mainRef)
  const playback = useSurahPlayback(surah, surahMeta.verses)
  const { player, snapshot } = playback
  const [selected, setSelected] = useState<VerseKey | null>(targetVerse ? verseKey(surah, targetVerse) : null)

  // aller au verset demandé (?v=)
  useEffect(() => {
    if (!targetVerse) {
      // ne pas renvoyer le résultat : les navigateurs récents renvoient une promesse
      window.scrollTo({ top: 0 })
      return
    }
    const key = verseKey(surah, targetVerse)
    setSelected(key)
    requestAnimationFrame(() => document.querySelector(`[data-verse="${key}"]`)?.scrollIntoView({ block: 'center' }))
  }, [surah, targetVerse])

  // défilement automatique pendant la lecture
  useEffect(() => {
    const key = snapshot.activeVerse
    if (!key || !s.autoScroll) return
    const el = document.querySelector<HTMLElement>(`[data-verse="${key}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 90
    if (r.top < margin || r.bottom > window.innerHeight - margin) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [snapshot.activeVerse, s.autoScroll])

  const panelVerse = snapshot.activeVerse ?? selected ?? verseKey(surah, 1)
  useEffect(() => {
    setLast(panelVerse)
  }, [panelVerse, setLast])

  const onWordClick = useCallback(
    (id: WordId, e: React.MouseEvent) => {
      if (useSettings.getState().mask !== 'full') return flashReveal(e.currentTarget as HTMLElement)
      const { verse, position } = parseWordId(id)
      player?.playWord(verseKey(surah, verse), position)
    },
    [player, surah],
  )
  const onVerseNumberClick = useCallback((key: VerseKey) => {
    setSelected(key)
    useSettings.getState().set({ panelOpen: true })
  }, [])

  const ruleFilter = useMemo(() => ruleFilterFor(s.tajweedOnly), [s.tajweedOnly])
  const onModeChange = (mode: ReaderMode) => {
    s.set({ mode })
    if (mode === 'mushaf') navigate(`/page/${pageOfVerse(index, panelVerse)}`)
  }

  return (
    <ReaderLayout
      title={`${surahMeta.n}. ${surahMeta.translit}`}
      subtitle={surahMeta.fr}
      mode="reading"
      onModeChange={onModeChange}
      meta={meta}
      index={index}
      currentSurah={surah}
      panel={{ meta: surahMeta, verse: parseVerseKey(panelVerse).verse }}
      mainRef={mainRef}
      player={
        <PlayerBar
          playback={playback}
          verseCount={surahMeta.verses}
          startIndex={selected ? parseVerseKey(selected).verse - 1 : 0}
        />
      }
    >
      <div className="mx-auto max-w-4xl">
        <ReadingView
          meta={surahMeta}
          text={text}
          basmala={basmala}
          fontSize={fontSize}
          highlight={s.highlight}
          activeVerse={snapshot.activeVerse}
          activeWord={snapshot.activeWord}
          selectedVerse={selected}
          player={player}
          tajweed={s.tajweed}
          ruleFilter={ruleFilter}
          mask={s.mask}
          onWordClick={onWordClick}
          onVerseNumberClick={onVerseNumberClick}
        />
        <nav className="mt-6 flex justify-between gap-2">
          {surah < 114 ? (
            <Button asChild variant="outline" size="touch">
              <Link to={`/lire/${surah + 1}`}>
                <ChevronLeft /> {meta[surah]!.translit}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {surah > 1 && (
            <Button asChild variant="outline" size="touch">
              <Link to={`/lire/${surah - 1}`}>
                {meta[surah - 2]!.translit} <ChevronRight />
              </Link>
            </Button>
          )}
        </nav>
        <p className="mt-6 text-center text-xs text-muted-foreground">{t('wordTapHint')}</p>
      </div>
    </ReaderLayout>
  )
}

// ---------------------------------------------------------------------------
// Mode Mushaf : /page/:page
// ---------------------------------------------------------------------------

export function MushafReaderPage() {
  const params = useParams()
  const page = clampPage(Number(params.page) || 1)
  const data = useAsync(() => Promise.all([loadMeta(), loadIndex(), loadSurah(1)]), [])
  const pageData = useAsync(() => loadPage(page), [page])
  if (data.status !== 'ready') return <Loading error={data.status === 'error' ? data.error : null} />
  const [meta, index, fatiha] = data.value
  return (
    <MushafReader
      page={page}
      pageData={pageData.status === 'ready' ? pageData.value : null}
      meta={meta}
      index={index}
      basmala={fatiha.verses[0]!.words}
    />
  )
}

function MushafReader({
  page,
  pageData,
  meta,
  index,
  basmala,
}: {
  page: number
  pageData: Awaited<ReturnType<typeof loadPage>> | null
  meta: Awaited<ReturnType<typeof loadMeta>>
  index: Awaited<ReturnType<typeof loadIndex>>
  basmala: Awaited<ReturnType<typeof loadSurah>>['verses'][number]['words']
}) {
  const { t } = useTranslation('reader')
  const navigate = useNavigate()
  const s = useSettings()
  const setLast = useProgress((p) => p.setLast)
  const mainRef = useRef<HTMLElement>(null)
  const fontSize = useFontPinch(mainRef)
  const width = useElementWidth(mainRef)
  const wide = useMediaQuery('(min-width: 768px)')
  const pageInfo = index.pages[page - 1]!
  const [selected, setSelected] = useState<VerseKey | null>(null)
  // sourate jouée : celle du verset sélectionné, sinon la première de la page
  const [playSurah, setPlaySurah] = useState(pageInfo.surahs[0]!)
  useEffect(() => {
    setPlaySurah((cur) => (pageInfo.surahs.includes(cur) ? cur : pageInfo.surahs[0]!))
  }, [pageInfo])
  const surahMeta = meta[playSurah - 1]!
  const playback = useSurahPlayback(playSurah, surahMeta.verses)
  const { player, snapshot } = playback

  const goPage = useCallback((p: number) => navigate(`/page/${clampPage(p)}`), [navigate])

  // la lecture tourne les pages toute seule
  useEffect(() => {
    if (!snapshot.activeVerse) return
    const p = pageOfVerse(index, snapshot.activeVerse)
    if (p !== page) navigate(`/page/${p}`, { replace: true })
  }, [snapshot.activeVerse, index, page, navigate])

  // flèches du clavier (Mushaf de droite à gauche : ← = page suivante)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') goPage(page + 1)
      if (e.key === 'ArrowRight') goPage(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, goPage])
  // balayage : vers la droite = page suivante (on tourne les pages comme un Mushaf)
  useSwipe(mainRef, (dir) => goPage(dir === 1 ? page + 1 : page - 1))

  const firstOnPage = parseVerseKey(pageInfo.first)
  const panelVerse =
    snapshot.activeVerse ?? selected ?? (firstOnPage.surah === playSurah ? pageInfo.first : verseKey(playSurah, 1))
  useEffect(() => {
    setLast(panelVerse)
  }, [panelVerse, setLast])
  const startIndex = selected
    ? parseVerseKey(selected).verse - 1
    : firstOnPage.surah === playSurah
      ? firstOnPage.verse - 1
      : 0

  const onWordClick = useCallback(
    (id: WordId, e: React.MouseEvent) => {
      if (useSettings.getState().mask !== 'full') return flashReveal(e.currentTarget as HTMLElement)
      const w = parseWordId(id)
      if (w.surah !== playSurah) {
        setPlaySurah(w.surah)
        setSelected(verseKey(w.surah, w.verse))
        return
      }
      player?.playWord(verseKey(w.surah, w.verse), w.position)
    },
    [player, playSurah],
  )
  const onVerseNumberClick = useCallback((key: VerseKey) => {
    setSelected(key)
    setPlaySurah(parseVerseKey(key).surah)
    useSettings.getState().set({ panelOpen: true })
  }, [])

  const onModeChange = (mode: ReaderMode) => {
    s.set({ mode })
    if (mode === 'reading') {
      const { surah, verse } = parseVerseKey(panelVerse)
      navigate(`/lire/${surah}?v=${verse}`)
    }
  }

  // flèches latérales (≥ md) : 2 × (44 px + écart)
  const arrows = wide ? 2 * 52 : 0
  const pageWidth = Math.max(260, Math.min(width - arrows - 4, fontSize * 12))
  const activeWordId = snapshot.activeWord && s.highlight !== 'verse'
    ? (`${snapshot.activeWord.verse}:${snapshot.activeWord.position}` as WordId)
    : null

  return (
    <ReaderLayout
      title={t('mushaf.pageTitle', { page })}
      subtitle={pageInfo.surahs.map((n) => meta[n - 1]!.translit).join(' · ')}
      mode="mushaf"
      onModeChange={onModeChange}
      meta={meta}
      index={index}
      currentSurah={playSurah}
      panel={{ meta: meta[parseVerseKey(panelVerse).surah - 1]!, verse: parseVerseKey(panelVerse).verse }}
      mainRef={mainRef}
      tajweedAvailable={false}
      player={<PlayerBar playback={playback} verseCount={surahMeta.verses} startIndex={startIndex} allowLetter={false} />}
    >
      <div className="flex items-start justify-center gap-2">
        <Button
          variant="ghost"
          size="icon-touch"
          className="mt-40 hidden md:inline-flex"
          onClick={() => goPage(page + 1)}
          disabled={page >= PAGE_COUNT}
          aria-label={t('mushaf.next')}
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-0 overflow-x-auto">
          {pageData ? (
            <MushafPageView
              page={pageData}
              meta={meta}
              basmala={basmala}
              font="v2"
              width={pageWidth}
              activeVerse={snapshot.activeVerse}
              activeWord={activeWordId}
              selectedVerse={selected}
              mask={s.mask}
              onWordClick={onWordClick}
              onVerseNumberClick={onVerseNumberClick}
            />
          ) : (
            <div style={{ width: pageWidth, height: pageWidth * 1.7 }} className="rounded-md bg-muted" />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-touch"
          className="mt-40 hidden md:inline-flex"
          onClick={() => goPage(page - 1)}
          disabled={page <= 1}
          aria-label={t('mushaf.prev')}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 md:hidden">
        <Button variant="outline" size="touch" onClick={() => goPage(page + 1)} disabled={page >= PAGE_COUNT}>
          <ChevronLeft /> {t('mushaf.next')}
        </Button>
        <Button variant="outline" size="touch" onClick={() => goPage(page - 1)} disabled={page <= 1}>
          {t('mushaf.prev')} <ChevronRight />
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t('mushaf.hint')}</p>
    </ReaderLayout>
  )
}

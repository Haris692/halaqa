import type {
  MushafPage,
  QuranIndex,
  Recitation,
  ReciterInfo,
  SourcesIndex,
  SurahCommentary,
  SurahMeta,
  SurahText,
} from '@/core/quran/types'
import { asset } from '@/lib/asset'

/**
 * Chargement des données coraniques statiques (public/quran), avec cache mémoire.
 * Le cache hors ligne (service worker) arrivera avec la PWA (phase 6).
 */
const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(asset(path)).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${path}`)
      return res.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

const pad3 = (n: number) => String(n).padStart(3, '0')

export const loadMeta = () => load<SurahMeta[]>('/quran/meta.json')
export const loadIndex = () => load<QuranIndex>('/quran/index.json')
export const loadReciters = () => load<ReciterInfo[]>('/quran/reciters.json')
export const loadSources = () => load<SourcesIndex>('/quran/sources.json')
export const loadSurah = (n: number) => load<SurahText>(`/quran/text/${pad3(n)}.json`)
export const loadPage = (n: number) => load<MushafPage>(`/quran/pages/${pad3(n)}.json`)
export const loadTranslation = (key: string, surah: number) =>
  load<SurahCommentary>(`/quran/translations/${key}/${pad3(surah)}.json`)
export const loadTafsir = (key: string, surah: number) => load<SurahCommentary>(`/quran/tafsir/${key}/${pad3(surah)}.json`)

export const loadRecitation = (reciter: string, surah: number) =>
  load<Recitation>(`/quran/recitations/${reciter}/${pad3(surah)}.json`).then(withAssetUrls)

/** Audio hébergé chez nous : chemin relatif à la racine du site, on y ajoute la base. */
const audioUrl = (src: string) => (/^https?:/.test(src) ? src : asset(src))

function withAssetUrls(rec: Recitation): Recitation {
  if (rec.format === 'gapless') return { ...rec, audio: audioUrl(rec.audio) }
  const verses: typeof rec.verses = {}
  for (const [key, v] of Object.entries(rec.verses)) verses[key as keyof typeof verses] = { ...v, audio: audioUrl(v.audio) }
  return { ...rec, verses }
}

/** Charge dynamiquement la police QPC V2 propre à une page du Mushaf. */
const loadedPageFonts = new Map<number, Promise<string>>()
export function loadPageFont(page: number): Promise<string> {
  let p = loadedPageFonts.get(page)
  if (!p) {
    const family = `qpc-v2-p${page}`
    const face = new FontFace(family, `url(${asset(`/fonts/qpc-v2/p${page}.woff2`)})`, { display: 'block' })
    p = face.load().then((f) => {
      document.fonts.add(f)
      return family
    })
    p.catch(() => loadedPageFonts.delete(page))
    loadedPageFonts.set(page, p)
  }
  return p
}

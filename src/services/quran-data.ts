import type { MushafPage, Recitation, SurahMeta, SurahText } from '@/core/quran/types'
import { asset } from '@/lib/asset'

/**
 * Chargement des données coraniques statiques (public/quran), avec cache mémoire.
 * Le cache hors ligne (service worker) arrivera avec la PWA.
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
export const loadSurah = (n: number) => load<SurahText>(`/quran/text/${pad3(n)}.json`)
export const loadPage = (n: number) => load<MushafPage>(`/quran/pages/${pad3(n)}.json`)
export const loadRecitation = (id: RecitationId, surah: number) =>
  load<Recitation>(`/quran/recitations/${id}/${pad3(surah)}.json`).then(withAssetUrls)

/** Les chemins audio des JSON sont relatifs à la racine du site : on y ajoute la base. */
function withAssetUrls(rec: Recitation): Recitation {
  if (rec.format === 'gapless') return { ...rec, audio: asset(rec.audio) }
  const verses: typeof rec.verses = {}
  for (const [key, v] of Object.entries(rec.verses)) verses[key as keyof typeof verses] = { ...v, audio: asset(v.audio) }
  return { ...rec, verses }
}

export const RECITATIONS = ['husary-muallim-qdc', 'husary-muallim-cpfair'] as const
export type RecitationId = (typeof RECITATIONS)[number]

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
    loadedPageFonts.set(page, p)
  }
  return p
}

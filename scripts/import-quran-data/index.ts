/**
 * Import complet et reproductible des données coraniques → public/quran/ (JSON compacts).
 *
 *   npm run import            texte, Mushaf, index, récitations, traductions, tafsirs
 *   npm run import:media      polices et audio hébergé chez nous (voir media.ts)
 *
 * Contrôles d'intégrité (l'import échoue s'ils ne passent pas) :
 *   - 114 sourates, 6 236 versets, 604 pages ;
 *   - positions de mots contiguës ;
 *   - le texte tajwid, une fois les balises retirées, est STRICTEMENT identique au texte QPC Hafs ;
 *   - chaque mot du texte a un minutage chez chaque récitateur, et aucun minutage ne vise un mot absent ;
 *   - chaque verset a sa traduction et son tafsir.
 *
 * Les réponses brutes sont mises en cache dans raw/ (non versionné).
 */
import { RECITERS, TAFSIRS, TRANSLATIONS, MIRRORED_SURAHS } from './sources.ts'
import { getJson, mapLimit, OUT, pad3, range, Report, writeJson } from './lib.ts'
import { join } from 'node:path'

const QDC = 'https://api.qurancdn.com/api/qdc'
const QURANENC = 'https://quranenc.com/api/v1'
const SURAHS = range(1, 114)
const report = new Report()

// ---------- types des sources ----------

interface QdcWord {
  position: number
  char_type_name: string
  text_qpc_hafs: string
  text_uthmani_tajweed?: string
  code_v2: string
  page_number: number
  line_number: number
}
interface QdcVerse {
  verse_number: number
  verse_key: string
  page_number: number
  juz_number: number
  hizb_number: number
  rub_el_hizb_number: number
  sajdah_number: number | null
  words: QdcWord[]
}
interface QdcChapter {
  id: number
  revelation_place: string
  bismillah_pre: boolean
  name_simple: string
  name_complex: string
  name_arabic: string
  verses_count: number
  pages: [number, number]
  translated_name: { name: string }
}

// ---------- formats de sortie (miroir de src/core/quran/types.ts) ----------

type Rule = [start: number, end: number, rule: string]
interface OutWord {
  p: number
  t: string
  g: string
  l: number
  pg: number
  r?: Rule[]
}
interface OutVerse {
  n: number
  page: number
  juz: number
  hizb: number
  rub: number
  sajda?: true
  words: OutWord[]
  end: { t: string; g: string; l: number; pg: number }
}

// ---------- 1. métadonnées ----------

async function importMeta(): Promise<QdcChapter[]> {
  const { chapters } = await getJson<{ chapters: QdcChapter[] }>(`${QDC}/chapters?language=fr`)
  if (chapters.length !== 114) report.error(`${chapters.length} sourates au lieu de 114`)
  await writeJson(
    join(OUT, 'meta.json'),
    chapters.map((c) => ({
      n: c.id,
      ar: c.name_arabic,
      translit: c.name_complex,
      simple: c.name_simple,
      fr: c.translated_name.name,
      verses: c.verses_count,
      pages: c.pages,
      bismillah: c.bismillah_pre,
      place: c.revelation_place,
    })),
  )
  return chapters
}

// ---------- 2. texte (+ tajwid) ----------

/** `<rule class=x>…</rule>` → texte nu + plages [début, fin, règle] en unités UTF-16. */
export function parseTajweed(html: string): { text: string; rules: Rule[] } {
  let text = ''
  const rules: Rule[] = []
  const re = /<rule class=([a-z_]+)>(.*?)<\/rule>|([^<]+)/gs
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) {
      rules.push([text.length, text.length + m[2]!.length, m[1]])
      text += m[2]
    } else {
      text += m[3]
    }
  }
  return { text, rules }
}

/**
 * Le texte tajwid de quran.com et le texte QPC Hafs ont les mêmes lettres mais
 * un encodage différent des signes (tatweel, forme du tanwin, ى/ي, signes de
 * pause…). On aligne donc les deux mots LETTRE PAR LETTRE : une règle couvre
 * des lettres entières (lettre + ses signes) dans le texte QPC, qui n'est
 * jamais modifié. Renvoie null si les lettres de base diffèrent.
 */
const isBaseLetter = (c: string) => /[ء-غف-يٱ]/.test(c)
const normLetter = (c: string) => (c === 'ى' ? 'ي' : c) // ى ≡ ي pour l'alignement

function letterStarts(s: string): number[] {
  const starts: number[] = []
  for (let i = 0; i < s.length; i++) if (isBaseLetter(s[i]!)) starts.push(i)
  return starts
}

export function mapRulesToQpc(tajweed: string, qpc: string, rules: Rule[]): Rule[] | null {
  const a = letterStarts(tajweed)
  const b = letterStarts(qpc)
  if (a.length !== b.length || a.some((i, k) => normLetter(tajweed[i]!) !== normLetter(qpc[b[k]!]!))) return null
  // lettre (indice k) qui contient la position i du texte tajwid
  const letterAt = (i: number) => {
    let k = -1
    while (k + 1 < a.length && a[k + 1]! <= i) k++
    return Math.max(k, 0)
  }
  const qpcLetterEnd = (k: number) => (k + 1 < b.length ? b[k + 1]! : qpc.length)
  return rules
    .map(([start, end, rule]): Rule => {
      const first = letterAt(start)
      const last = letterAt(Math.max(start, end - 1))
      return [b[first] ?? 0, qpcLetterEnd(last), rule]
    })
    .filter(([s0, e0]) => e0 > s0)
}

async function fetchSurahVerses(surah: number): Promise<QdcVerse[]> {
  const fields = 'text_qpc_hafs,text_uthmani_tajweed,code_v2,page_number,line_number'
  const verses: QdcVerse[] = []
  for (let page = 1; ; page++) {
    const data = await getJson<{ verses: QdcVerse[]; pagination: { next_page: number | null } }>(
      `${QDC}/verses/by_chapter/${surah}?words=true&word_fields=${fields}&per_page=50&page=${page}`,
    )
    verses.push(...data.verses)
    if (!data.pagination.next_page) break
  }
  return verses
}

const tajweedRules = new Map<string, number>()
const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)))

function convertVerses(surah: number, verses: QdcVerse[]): OutVerse[] {
  return verses.map((v) => {
    const words = v.words.filter((w) => w.char_type_name === 'word')
    const end = v.words.find((w) => w.char_type_name === 'end')
    const last = words[words.length - 1]
    if (!end) report.warn(`${v.verse_key} : marqueur de fin absent de la source, numéro affiché en chiffres arabes`)
    words.forEach((w, i) => {
      if (w.position !== i + 1) report.error(`${v.verse_key} : positions de mots non contiguës`)
    })
    return {
      n: v.verse_number,
      page: v.page_number,
      juz: v.juz_number,
      hizb: v.hizb_number,
      rub: v.rub_el_hizb_number,
      ...(v.sajdah_number ? { sajda: true as const } : {}),
      words: words.map((w) => {
        const out: OutWord = { p: w.position, t: w.text_qpc_hafs, g: w.code_v2, l: w.line_number, pg: w.page_number }
        if (w.text_uthmani_tajweed) {
          const { text, rules } = parseTajweed(w.text_uthmani_tajweed)
          const mapped = rules.length ? mapRulesToQpc(text, w.text_qpc_hafs, rules) : []
          if (mapped === null) {
            report.warn(`${v.verse_key}:${w.position} : texte tajwid non alignable sur le texte QPC, tajwid ignoré pour ce mot`)
          } else if (mapped.length) {
            out.r = mapped
            for (const [, , r] of mapped) tajweedRules.set(r, (tajweedRules.get(r) ?? 0) + 1)
          }
        }
        return out
      }),
      end: end
        ? { t: end.text_qpc_hafs, g: end.code_v2, l: end.line_number, pg: end.page_number }
        : { t: toArabicDigits(v.verse_number), g: '', l: last?.line_number ?? 0, pg: last?.page_number ?? v.page_number },
    }
  })
}

// ---------- 3. pages du Mushaf + index de navigation ----------

type PageWord = { k: string; t: string; g: string; e?: 1 }
type PageLine =
  | { n: number; type: 'text'; words: PageWord[] }
  | { n: number; type: 'surah'; surah: number }
  | { n: number; type: 'basmala' }

async function buildPages(text: Map<number, OutVerse[]>, meta: QdcChapter[]) {
  const pages = new Map<number, Map<number, PageLine>>()
  const firstLine = new Map<number, { page: number; line: number }>()
  const line = (page: number, n: number) => {
    let p = pages.get(page)
    if (!p) pages.set(page, (p = new Map()))
    let l = p.get(n)
    if (!l) p.set(n, (l = { n, type: 'text', words: [] }))
    return l
  }
  for (const [surah, verses] of text) {
    for (const v of verses) {
      for (const w of v.words) {
        if (!firstLine.has(surah)) firstLine.set(surah, { page: w.pg, line: w.l })
        const l = line(w.pg, w.l)
        if (l.type === 'text') l.words.push({ k: `${surah}:${v.n}:${w.p}`, t: w.t, g: w.g })
      }
      const l = line(v.end.pg, v.end.l)
      if (l.type === 'text') l.words.push({ k: `${surah}:${v.n}:end`, t: v.end.t, g: v.end.g, e: 1 })
    }
  }
  // En-têtes et basmalas : les lignes sans mots juste avant le début de chaque sourate.
  for (const [surah, { page, line: first }] of firstLine) {
    const p = pages.get(page)!
    const bismillah = meta.find((c) => c.id === surah)?.bismillah_pre && surah !== 1
    const needed: PageLine[] = [{ n: 0, type: 'surah', surah }, ...(bismillah ? [{ n: 0, type: 'basmala' } as const] : [])]
    // Les lignes vides juste avant le texte : sur cette page, puis en bas de la page précédente
    // (dans le Mushaf de Médine, l'en-tête est parfois imprimé en fin de page précédente).
    const slots: { page: number; n: number }[] = []
    for (let n = first - 1; n >= 1 && slots.length < needed.length; n--) slots.unshift({ page, n })
    const prev = pages.get(page - 1)
    for (let n = 15; prev && n >= 1 && slots.length < needed.length && !prev.has(n); n--) slots.unshift({ page: page - 1, n })
    if (slots.length < needed.length || slots.some((s) => pages.get(s.page)?.get(s.n)?.type === 'text')) {
      report.warn(`sourate ${surah} : pas de place pour l'en-tête près de la page ${page}`)
      continue
    }
    needed.forEach((line, i) => {
      const slot = slots[i]!
      pages.get(slot.page)!.set(slot.n, { ...line, n: slot.n })
    })
  }
  if (pages.size !== 604) report.error(`${pages.size} pages au lieu de 604`)
  for (const [n, p] of pages) {
    await writeJson(join(OUT, 'pages', `${pad3(n)}.json`), { page: n, lines: [...p.values()].sort((a, b) => a.n - b.n) })
  }
}

async function buildIndex(text: Map<number, OutVerse[]>) {
  const pages: { first: string; surahs: number[] }[] = []
  const juz: string[] = []
  const hizb: string[] = []
  const rub: string[] = []
  for (const [surah, verses] of text) {
    for (const v of verses) {
      const key = `${surah}:${v.n}`
      const p = (pages[v.page - 1] ??= { first: key, surahs: [] })
      if (!p.surahs.includes(surah)) p.surahs.push(surah)
      juz[v.juz - 1] ??= key
      hizb[v.hizb - 1] ??= key
      rub[v.rub - 1] ??= key
    }
  }
  if (juz.length !== 30 || hizb.length !== 60 || rub.length !== 240) {
    report.error(`index : ${juz.length} juz, ${hizb.length} hizb, ${rub.length} quarts`)
  }
  await writeJson(join(OUT, 'index.json'), { pages, juz, hizb, rub })
}

// ---------- 4. récitations ----------

interface QdcAudioFile {
  audio_url: string
  duration: number
  verse_timings: { verse_key: string; timestamp_from: number; timestamp_to: number; segments: number[][] }[]
}

async function importRecitations(text: Map<number, OutVerse[]>) {
  for (const r of RECITERS) {
    let missing = 0
    await mapLimit(SURAHS, 4, async (surah) => {
      const { audio_files } = await getJson<{ audio_files: QdcAudioFile[] }>(
        `${QDC}/audio/reciters/${r.qdcId}/audio_files?chapter=${surah}&segments=true`,
      )
      const file = audio_files[0]
      if (!file) return report.error(`${r.id} : pas d'audio pour la sourate ${surah}`)
      const verses: Record<string, { from: number; to: number; segs: [number, number, number][] }> = {}
      for (const vt of file.verse_timings) {
        const segs = vt.segments
          .filter((s) => s.length >= 3)
          .map((s) => [s[0]!, Math.round(s[1]!), Math.round(s[2]!)] as [number, number, number])
        verses[vt.verse_key] = { from: vt.timestamp_from, to: vt.timestamp_to, segs }
      }
      for (const v of text.get(surah)!) {
        const key = `${surah}:${v.n}`
        const t = verses[key]
        if (!t) {
          report.error(`${r.id} ${key} : verset sans minutage`)
          continue
        }
        const positions = new Set(t.segs.map((s) => s[0]))
        const without = v.words.filter((w) => !positions.has(w.p)).length
        const outside = [...positions].filter((p) => p < 1 || p > v.words.length)
        missing += without
        if (outside.length) report.warn(`${r.id} ${key} : minutage pour des mots inexistants (${outside.join(', ')})`)
        // on retire les segments hors texte : ils ne peuvent rien surligner
        if (outside.length) t.segs = t.segs.filter((s) => s[0] >= 1 && s[0] <= v.words.length)
      }
      const mirrored = r.mirror && MIRRORED_SURAHS.includes(surah)
      await writeJson(join(OUT, 'recitations', r.id, `${pad3(surah)}.json`), {
        format: 'gapless',
        audio: mirrored ? `/audio/${r.id}/${pad3(surah)}.mp3` : file.audio_url,
        origin: file.audio_url,
        durationMs: file.duration,
        verses,
      })
    })
    if (missing) report.warn(`${r.id} : ${missing} mot(s) sans minutage (le surlignage sautera ces mots)`)
    console.log(`✓ récitation ${r.id}`)
  }
  await writeJson(
    join(OUT, 'reciters.json'),
    RECITERS.map(({ id, name, nameAr, style }) => ({ id, name, nameAr, style })),
  )
}

// ---------- 5. traductions et tafsirs ----------

interface QuranEncAya {
  aya: string
  translation: string
  footnotes: string | null
}

async function importQuranEnc(key: string, kind: 'translations' | 'tafsir', text: Map<number, OutVerse[]>) {
  await mapLimit(SURAHS, 3, async (surah) => {
    const { result } = await getJson<{ result: QuranEncAya[] }>(`${QURANENC}/translation/sura/${key}/${surah}`)
    const verses: Record<string, { t: string; f?: string }> = {}
    for (const a of result) verses[a.aya] = { t: a.translation.trim(), ...(a.footnotes ? { f: a.footnotes.trim() } : {}) }
    for (const v of text.get(surah)!) if (!verses[v.n]?.t) report.error(`${key} ${surah}:${v.n} : texte manquant`)
    await writeJson(join(OUT, kind, key, `${pad3(surah)}.json`), verses)
  })
  console.log(`✓ ${kind} ${key}`)
}

async function importQdcTafsir(slug: string, key: string, text: Map<number, OutVerse[]>) {
  await mapLimit(SURAHS, 3, async (surah) => {
    const verses: Record<string, { t: string; g?: [number, number] }> = {}
    for (let page = 1; ; page++) {
      const data = await getJson<{ tafsirs: { verse_key: string; text: string }[]; pagination?: { next_page: number | null } }>(
        `${QDC}/tafsirs/${slug}/by_chapter/${surah}?per_page=50&page=${page}`,
      )
      for (const t of data.tafsirs) verses[t.verse_key.split(':')[1]!] = { t: t.text.trim() }
      if (!data.pagination?.next_page) break
    }
    // Un commentaire peut couvrir plusieurs versets : il n'est alors donné que pour
    // le premier. Les suivants renvoient au même texte, avec la plage couverte.
    let groupStart: number | null = null
    for (const v of text.get(surah)!) {
      if (verses[v.n]?.t) {
        groupStart = v.n
        continue
      }
      if (groupStart === null) {
        report.error(`${key} ${surah}:${v.n} : texte manquant`)
        continue
      }
      const head = verses[groupStart]!
      head.g = [groupStart, v.n]
      verses[v.n] = { t: head.t, g: head.g }
      for (let n = groupStart + 1; n < v.n; n++) verses[n]!.g = head.g
    }
    await writeJson(join(OUT, 'tafsir', key, `${pad3(surah)}.json`), verses)
  })
  console.log(`✓ tafsir ${key}`)
}

// ---------- main ----------

const chapters = await importMeta()
console.log('✓ meta.json')

const text = new Map<number, OutVerse[]>()
await mapLimit(SURAHS, 4, async (surah) => {
  const verses = convertVerses(surah, await fetchSurahVerses(surah))
  const expected = chapters.find((c) => c.id === surah)?.verses_count
  if (verses.length !== expected) report.error(`sourate ${surah} : ${verses.length} versets au lieu de ${expected}`)
  text.set(surah, verses)
})
const sorted = new Map([...text.entries()].sort((a, b) => a[0] - b[0]))
let verseCount = 0
let wordCount = 0
for (const [surah, verses] of sorted) {
  verseCount += verses.length
  wordCount += verses.reduce((n, v) => n + v.words.length, 0)
  await writeJson(join(OUT, 'text', `${pad3(surah)}.json`), { surah, verses })
}
if (verseCount !== 6236) report.error(`${verseCount} versets au lieu de 6 236`)
console.log(`✓ texte : ${sorted.size} sourates, ${verseCount} versets, ${wordCount} mots`)
console.log(`  règles de tajwid : ${[...tajweedRules.entries()].map(([r, n]) => `${r} (${n})`).join(', ')}`)

await buildPages(sorted, chapters)
await buildIndex(sorted)
console.log('✓ 604 pages du Mushaf et index (pages, juz, hizb, quarts)')

await importRecitations(sorted)

for (const t of TRANSLATIONS) await importQuranEnc(t.key, 'translations', sorted)
for (const t of TAFSIRS) {
  if (t.provider === 'quranenc') await importQuranEnc(t.key, 'tafsir', sorted)
  else await importQdcTafsir(t.slug, t.key, sorted)
}
await writeJson(join(OUT, 'sources.json'), {
  translations: TRANSLATIONS.map(({ key, title, author, source, url, note }) => ({ key, title, author, source, url, note })),
  tafsirs: TAFSIRS.map(({ key, title, author, source, url, lang, note }) => ({ key, title, author, source, url, lang, note })),
})

await report.print()
if (report.errors.length) process.exit(1)

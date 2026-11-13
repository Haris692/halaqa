/**
 * Import minimal pour la phase 0 (prototypes).
 *
 * Récupère, pour al-Fatiha (1) et al-Ikhlas (112) :
 *  - le texte QPC Hafs mot à mot (+ glyphes V2, page et ligne du Mushaf),
 *  - deux sources de minutage de Husary Mu'allim :
 *      a) quran.com / QUL (audio sourate complète, segments mot à mot),
 *      b) cpfair/quran-align (CC BY 4.0) + audio verset par verset d'everyayah,
 *  - les pages 1 et 604 du Mushaf (texte de 113 et 114 inclus pour la page 604),
 *  - les polices nécessaires aux labos.
 *
 * Usage : npm run import:phase0
 * Le script complet et reproductible (114 sourates) viendra en phase 1.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const RAW = join(ROOT, 'scripts/import-quran-data/raw')
const OUT = join(ROOT, 'public/quran')
const FONTS = join(ROOT, 'public/fonts')

const QDC = 'https://api.qurancdn.com/api/qdc'
const QDC_HUSARY_MUALLIM = 12
const CPFAIR_ZIP =
  'https://github.com/cpfair/quran-align/releases/download/release-2016-11-24/quran-align-data-2016-11-24.zip'
const EVERYAYAH = 'https://everyayah.com/data/Husary_Muallim_128kbps'

const RECITED_SURAHS = [1, 112]
const TEXT_SURAHS = [1, 112, 113, 114]
const PAGES = [1, 604]

// ---------- utilitaires ----------

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return (await res.json()) as T
}

async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data))
}

const pad3 = (n: number) => String(n).padStart(3, '0')

// ---------- types des API sources ----------

interface QdcWord {
  position: number
  char_type_name: 'word' | 'end' | string
  text_qpc_hafs: string
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

// ---------- formats de sortie (voir src/core/quran/types.ts) ----------

interface OutWord {
  p: number
  t: string
  g: string
  l: number
}
interface OutVerse {
  n: number
  page: number
  juz: number
  hizb: number
  words: OutWord[]
  end: OutWord
}

// ---------- étapes ----------

async function importMeta(): Promise<QdcChapter[]> {
  const { chapters } = await getJson<{ chapters: QdcChapter[] }>(`${QDC}/chapters?language=fr`)
  if (chapters.length !== 114) throw new Error(`114 sourates attendues, ${chapters.length} reçues`)
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

async function fetchVerses(surah: number): Promise<QdcVerse[]> {
  const fields = 'text_qpc_hafs,code_v2,page_number,line_number'
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

function toOutWord(w: QdcWord): OutWord {
  return { p: w.position, t: w.text_qpc_hafs, g: w.code_v2, l: w.line_number }
}

async function importText(surah: number, expectedVerses: number): Promise<OutVerse[]> {
  const verses = await fetchVerses(surah)
  if (verses.length !== expectedVerses) {
    throw new Error(`Sourate ${surah} : ${expectedVerses} versets attendus, ${verses.length} reçus`)
  }
  const out: OutVerse[] = verses.map((v) => {
    const words = v.words.filter((w) => w.char_type_name === 'word')
    const end = v.words.find((w) => w.char_type_name === 'end')
    if (!end) throw new Error(`Marqueur de fin manquant pour ${v.verse_key}`)
    words.forEach((w, i) => {
      if (w.position !== i + 1) throw new Error(`Positions non contiguës dans ${v.verse_key}`)
    })
    return {
      n: v.verse_number,
      page: v.page_number,
      juz: v.juz_number,
      hizb: v.hizb_number,
      words: words.map(toOutWord),
      end: toOutWord(end),
    }
  })
  await writeJson(join(OUT, 'text', `${pad3(surah)}.json`), { surah, verses: out })
  return out
}

/** Mise en page : les lignes sans mots sont des en-têtes de sourate ou des basmalas. */
async function importPage(page: number, textBySurah: Map<number, OutVerse[]>): Promise<void> {
  type Line =
    | { n: number; type: 'text'; words: string[] }
    | { n: number; type: 'surah'; surah: number }
    | { n: number; type: 'basmala' }
  const lines = new Map<number, Line>()
  const firstLineOfSurah = new Map<number, number>()

  for (const [surah, verses] of textBySurah) {
    for (const v of verses) {
      if (v.page !== page) continue
      for (const w of [...v.words, v.end]) {
        if (!firstLineOfSurah.has(surah) && v.n === 1) firstLineOfSurah.set(surah, w.l)
        const key = w === v.end ? `${surah}:${v.n}:end` : `${surah}:${v.n}:${w.p}`
        const line = lines.get(w.l)
        if (line && line.type === 'text') line.words.push(key)
        else lines.set(w.l, { n: w.l, type: 'text', words: [key] })
      }
    }
  }
  for (const [surah, first] of firstLineOfSurah) {
    if (surah === 1) {
      lines.set(first - 1, { n: first - 1, type: 'surah', surah })
    } else {
      lines.set(first - 2, { n: first - 2, type: 'surah', surah })
      if (surah !== 9) lines.set(first - 1, { n: first - 1, type: 'basmala' })
    }
  }
  const sorted = [...lines.values()].sort((a, b) => a.n - b.n)
  await writeJson(join(OUT, 'pages', `${pad3(page)}.json`), { page, lines: sorted })
}

interface QdcAudioFile {
  audio_url: string
  duration: number
  verse_timings: {
    verse_key: string
    timestamp_from: number
    timestamp_to: number
    segments: number[][]
  }[]
}

/** Source a) quran.com / QUL : audio sourate complète (gapless). */
async function importQdcRecitation(surah: number, text: OutVerse[], problems: string[]): Promise<void> {
  const { audio_files } = await getJson<{ audio_files: QdcAudioFile[] }>(
    `${QDC}/audio/reciters/${QDC_HUSARY_MUALLIM}/audio_files?chapter=${surah}&segments=true`,
  )
  const file = audio_files[0]
  if (!file) throw new Error(`Pas d'audio quran.com pour la sourate ${surah}`)
  const audioPath = `audio/husary-muallim/gapless/${pad3(surah)}.mp3`
  await download(file.audio_url, join(ROOT, 'public', audioPath))

  const verses: Record<string, { from: number; to: number; segs: [number, number, number][] }> = {}
  for (const vt of file.verse_timings) {
    const segs = vt.segments
      .filter((s) => s.length >= 3)
      .map((s) => [s[0]!, Math.round(s[1]!), Math.round(s[2]!)] as [number, number, number])
    verses[vt.verse_key] = { from: vt.timestamp_from, to: vt.timestamp_to, segs }
    checkSegments('quran.com', vt.verse_key, segs, text, problems)
  }
  await writeJson(join(OUT, 'recitations/husary-muallim-qdc', `${pad3(surah)}.json`), {
    format: 'gapless',
    audio: `/${audioPath}`,
    durationMs: file.duration,
    verses,
  })
}

interface CpfairEntry {
  surah: number
  ayah: number
  segments: [number, number, number, number][]
}

/** Source b) cpfair (CC BY 4.0) : audio verset par verset d'everyayah. */
async function importCpfairRecitation(
  surah: number,
  text: OutVerse[],
  cpfair: CpfairEntry[],
  problems: string[],
): Promise<void> {
  const verses: Record<string, { audio: string; segs: [number, number, number][] }> = {}
  for (const v of text) {
    const entry = cpfair.find((e) => e.surah === surah && e.ayah === v.n)
    const key = `${surah}:${v.n}`
    if (!entry) {
      problems.push(`cpfair ${key} : verset absent`)
      continue
    }
    // Format cpfair : [indexMotDébut (0-based), indexMotFin (exclusif), début_ms, fin_ms].
    // Un segment qui couvre plusieurs mots est réparti à parts égales (signalé).
    const segs: [number, number, number][] = []
    for (const [from, to, start, end] of entry.segments) {
      const count = to - from
      if (count > 1) problems.push(`cpfair ${key} : un segment couvre ${count} mots (${from + 1}–${to})`)
      for (let i = 0; i < count; i++) {
        const s = Math.round(start + ((end - start) * i) / count)
        const e = Math.round(start + ((end - start) * (i + 1)) / count)
        segs.push([from + i + 1, s, e])
      }
    }
    const file = `${pad3(surah)}${pad3(v.n)}.mp3`
    const audioPath = `audio/husary-muallim/ayah/${file}`
    await download(`${EVERYAYAH}/${file}`, join(ROOT, 'public', audioPath))
    verses[key] = { audio: `/${audioPath}`, segs }
    checkSegments('cpfair', key, segs, text, problems)
  }
  await writeJson(join(OUT, 'recitations/husary-muallim-cpfair', `${pad3(surah)}.json`), {
    format: 'ayah',
    verses,
  })
}

function checkSegments(
  source: string,
  key: string,
  segs: [number, number, number][],
  text: OutVerse[],
  problems: string[],
): void {
  const verse = text.find((v) => `${key.split(':')[0]}:${v.n}` === key)
  if (!verse) {
    problems.push(`${source} ${key} : verset inconnu dans le texte`)
    return
  }
  const positions = new Set(segs.map((s) => s[0]))
  const missing = verse.words.filter((w) => !positions.has(w.p)).map((w) => w.p)
  const extra = [...positions].filter((p) => p < 1 || p > verse.words.length)
  if (missing.length) problems.push(`${source} ${key} : mots sans minutage ${missing.join(', ')}`)
  if (extra.length) problems.push(`${source} ${key} : positions hors texte ${extra.join(', ')}`)
}

async function loadCpfair(): Promise<CpfairEntry[]> {
  const dir = join(RAW, 'cpfair')
  const zip = join(dir, 'quran-align-data.zip')
  const json = join(dir, 'Husary_Muallim_128kbps.json')
  await download(CPFAIR_ZIP, zip)
  if (!existsSync(json)) {
    // Sous Windows, on force le bsdtar du système (il lit les .zip ; le tar GNU de Git Bash non).
    const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar'
    execFileSync(tar, ['-xf', 'quran-align-data.zip', 'Husary_Muallim_128kbps.json', 'LICENSE', 'README'], {
      cwd: dir,
    })
  }
  const data = JSON.parse(await readFile(json, 'utf8')) as CpfairEntry[]
  if (data.length !== 6236) throw new Error(`cpfair : 6236 versets attendus, ${data.length} reçus`)
  return data
}

async function importFonts(): Promise<void> {
  const base = 'https://static.qurancdn.com/fonts/quran/hafs'
  await download(`${base}/uthmanic_hafs/UthmanicHafs1Ver18.woff2`, join(FONTS, 'qpc-hafs/UthmanicHafs1Ver18.woff2'))
  for (const page of PAGES) {
    await download(`${base}/v2/woff2/p${page}.woff2`, join(FONTS, `qpc-v2/p${page}.woff2`))
  }
}

// ---------- main ----------

const problems: string[] = []
const chapters = await importMeta()
console.log('✓ meta.json (114 sourates)')

const textBySurah = new Map<number, OutVerse[]>()
for (const surah of TEXT_SURAHS) {
  const expected = chapters.find((c) => c.id === surah)!.verses_count
  textBySurah.set(surah, await importText(surah, expected))
  console.log(`✓ texte sourate ${surah}`)
}
for (const page of PAGES) {
  await importPage(page, textBySurah)
  console.log(`✓ page ${page}`)
}

const cpfair = await loadCpfair()
for (const surah of RECITED_SURAHS) {
  const text = textBySurah.get(surah)!
  await importQdcRecitation(surah, text, problems)
  await importCpfairRecitation(surah, text, cpfair, problems)
  console.log(`✓ récitations sourate ${surah} (quran.com + cpfair)`)
}
await importFonts()
console.log('✓ polices')

if (problems.length) {
  console.log(`\n⚠ ${problems.length} point(s) d'intégrité :`)
  for (const p of problems) console.log('  - ' + p)
} else {
  console.log('\n✓ Intégrité : chaque mot du texte a un minutage dans les deux sources')
}

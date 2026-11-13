/**
 * Médias non versionnés (licences à confirmer, voir CREDITS.md), téléchargés
 * vers public/ : police QPC Hafs, 604 polices QPC V2 (une par page du Mushaf),
 * audio des sourates hébergées chez nous (al-Fatiha + Juz 'Amma).
 *
 *   npm run import:media     (à lancer après `npm run import`)
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { download, mapLimit, pad3, range, ROOT } from './lib.ts'
import { MIRRORED_SURAHS, RECITERS } from './sources.ts'

const FONTS = join(ROOT, 'public/fonts')
const CDN = 'https://static.qurancdn.com/fonts/quran/hafs'

let fetched = 0
const count = (did: boolean) => {
  if (did) fetched++
}

count(await download(`${CDN}/uthmanic_hafs/UthmanicHafs1Ver18.woff2`, join(FONTS, 'qpc-hafs/UthmanicHafs1Ver18.woff2')))
await mapLimit(range(1, 604), 8, async (page) =>
  count(await download(`${CDN}/v2/woff2/p${page}.woff2`, join(FONTS, `qpc-v2/p${page}.woff2`))),
)
console.log('✓ polices (QPC Hafs + 604 pages QPC V2)')

for (const r of RECITERS.filter((x) => x.mirror)) {
  await mapLimit(MIRRORED_SURAHS, 4, async (surah) => {
    const json = JSON.parse(await readFile(join(ROOT, 'public/quran/recitations', r.id, `${pad3(surah)}.json`), 'utf8'))
    count(await download(json.origin, join(ROOT, 'public', json.audio)))
  })
  console.log(`✓ audio ${r.id} : ${MIRRORED_SURAHS.length} sourates hébergées`)
}
console.log(`${fetched} fichier(s) téléchargé(s), les autres étaient déjà présents.`)

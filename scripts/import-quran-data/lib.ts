import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '../..')
export const RAW = join(ROOT, 'scripts/import-quran-data/raw')
export const OUT = join(ROOT, 'public/quran')

export const pad3 = (n: number) => String(n).padStart(3, '0')
export const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GET JSON avec cache disque (raw/http/…) et nouvelles tentatives : relancer
 * l'import ne resollicite pas les API, et une coupure réseau ne casse rien.
 * Supprimer raw/ pour forcer un nouveau téléchargement.
 */
export async function getJson<T>(url: string): Promise<T> {
  const file = join(RAW, 'http', createHash('sha1').update(url).digest('hex') + '.json')
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8')) as T
  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'halaqa-import/0.1' } })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      const text = await res.text()
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, text)
      return JSON.parse(text) as T
    } catch (e) {
      lastError = e
      await sleep(500 * attempt * attempt)
    }
  }
  throw lastError
}

export async function download(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return false
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, Buffer.from(await res.arrayBuffer()))
      return true
    } catch (e) {
      if (attempt === 4) throw e
      await sleep(500 * attempt * attempt)
    }
  }
  return false
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data))
}

/** Exécute `fn` sur chaque élément avec au plus `limit` appels simultanés. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!)
    }
  })
  await Promise.all(workers)
  return results
}

export class Report {
  readonly errors: string[] = []
  readonly warnings: string[] = []
  error(msg: string) {
    this.errors.push(msg)
  }
  warn(msg: string) {
    this.warnings.push(msg)
  }
  async print(): Promise<void> {
    const file = join(RAW, 'rapport-import.txt')
    await mkdir(RAW, { recursive: true })
    const lines = [...this.errors.map((e) => 'ERREUR ' + e), ...this.warnings.map((w) => 'AVERT. ' + w)]
    await writeFile(file, lines.join('\n'))
    // résumé par type d'avertissement (le texte après « : »)
    const byKind = new Map<string, number>()
    for (const w of this.warnings) {
      const kind = w.split(' : ').slice(1).join(' : ').replace(/\(.*\)/, '(…)')
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
    }
    if (byKind.size) {
      console.log(`\n⚠ ${this.warnings.length} avertissement(s) — détail dans ${file} :`)
      for (const [kind, n] of [...byKind].sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)} × ${kind}`)
    }
    if (this.errors.length) {
      console.log(`\n✗ ${this.errors.length} erreur(s) d'intégrité :`)
      for (const e of this.errors.slice(0, 40)) console.log('  - ' + e)
    } else {
      console.log('\n✓ Intégrité vérifiée')
    }
  }
}

import { execSync } from 'node:child_process'
import { expect, type Browser, type Page } from '@playwright/test'

/**
 * Outils communs aux scénarios de séance (comptes de démonstration de supabase/seed.sql).
 * Prérequis : `npm run db:start`, `npm run functions:serve`, LiveKit local (docs/phase-3.md).
 */

export const SUPABASE = 'http://127.0.0.1:54321'
// clé « secret » du Supabase LOCAL, lue au lancement (jamais écrite dans le dépôt)
export const LOCAL_SECRET =
  process.env.SUPABASE_LOCAL_SECRET ?? (JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' })) as { SECRET_KEY: string }).SECRET_KEY
export const CLASS_ID = '20000000-0000-0000-0000-000000000001'

const admin = { apikey: LOCAL_SECRET, Authorization: `Bearer ${LOCAL_SECRET}` }

export async function resetSessions() {
  const res = await fetch(`${SUPABASE}/rest/v1/live_sessions?class_id=eq.${CLASS_ID}`, { method: 'DELETE', headers: admin })
  expect(res.ok).toBe(true)
}

/** Lecture directe de la base locale (clé secrète) pour vérifier ce qui a été enregistré. */
export async function dbSelect<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE}/rest/v1/${path}`, { headers: admin })
  expect(res.ok).toBe(true)
  return (await res.json()) as T
}

export async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe').fill('halaqa-demo')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('link', { name: 'Mon compte' })).toBeVisible()
  return page
}

export const dock = (page: Page) => page.getByRole('region', { name: 'Séance en direct' })

export async function enter(page: Page) {
  await page.getByRole('button', { name: /Entrer dans la séance|Revenir à la séance/ }).click()
  await expect(dock(page)).toContainText('Salle principale', { timeout: 15_000 })
}

/** Le prof prépare (passage du jour par défaut) et démarre une séance, puis y entre. */
export async function startSession(prof: Page) {
  await prof.goto(`/prof/classe/${CLASS_ID}`)
  await prof.getByRole('button', { name: 'Préparer une séance' }).click()
  await expect(prof.getByRole('heading', { name: 'Plan de séance' })).toBeVisible()
  await prof.getByText('Passage du jour').click()
  await prof.getByRole('button', { name: 'Démarrer la séance' }).click()
  await enter(prof)
}

/** Les élèves voient le bandeau sur l'accueil et entrent. */
export async function joinFromHome(students: Page[]) {
  for (const student of students) {
    await student.goto('/')
    await student.getByRole('link', { name: /Séance en cours/ }).click()
    await enter(student)
  }
}

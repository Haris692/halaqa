import { execSync } from 'node:child_process'
import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Séance en direct : 1 prof + 2 élèves (comptes de démonstration de supabase/seed.sql).
 * Prérequis : `npm run db:start`, `npx supabase functions serve`, LiveKit local (docs/phase-3.md).
 */

const SUPABASE = 'http://127.0.0.1:54321'
// clé « secret » du Supabase LOCAL, lue au lancement (jamais écrite dans le dépôt)
const LOCAL_SECRET =
  process.env.SUPABASE_LOCAL_SECRET ?? (JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' })) as { SECRET_KEY: string }).SECRET_KEY
const CLASS_ID = '20000000-0000-0000-0000-000000000001'

async function resetSessions() {
  const res = await fetch(`${SUPABASE}/rest/v1/live_sessions?class_id=eq.${CLASS_ID}`, {
    method: 'DELETE',
    headers: { apikey: LOCAL_SECRET, Authorization: `Bearer ${LOCAL_SECRET}` },
  })
  expect(res.ok).toBe(true)
}

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe').fill('halaqa-demo')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('link', { name: 'Mon compte' })).toBeVisible()
  return page
}

const dock = (page: Page) => page.getByRole('region', { name: 'Séance en direct' })

async function enter(page: Page) {
  await page.getByRole('button', { name: /Entrer dans la séance|Revenir à la séance/ }).click()
  await expect(dock(page)).toContainText('Salle principale', { timeout: 15_000 })
}

test('séance : talqîn, main levée, salles, annonce, rappel', async ({ browser }) => {
  await resetSessions()
  const prof = await signIn(browser, 'prof@halaqa.test')
  const amina = await signIn(browser, 'eleve1@halaqa.test')
  const bilal = await signIn(browser, 'eleve2@halaqa.test')

  // le prof prépare et démarre la séance
  await prof.goto(`/prof/classe/${CLASS_ID}`)
  await prof.getByRole('button', { name: 'Préparer une séance' }).click()
  await expect(prof.getByRole('heading', { name: 'Plan de séance' })).toBeVisible()
  await prof.getByText('Passage du jour').click()
  await prof.getByRole('button', { name: 'Démarrer la séance' }).click()
  await enter(prof)
  await expect(prof).toHaveURL(/\/lire\/112/)

  // les élèves voient le bandeau sur l'accueil et entrent
  for (const student of [amina, bilal]) {
    await student.goto('/')
    await student.getByRole('link', { name: /Séance en cours/ }).click()
    await enter(student)
  }
  await expect(dock(prof)).toContainText('Amina')
  await expect(dock(prof)).toContainText('Bilal')

  // talqîn : la parole à Amina, le micro de Bilal est coupé par le serveur
  await prof.keyboard.press('Alt+d')
  const dashboard = prof.getByRole('dialog', { name: /Tableau de bord/ })
  await expect(dashboard).toBeVisible()
  await dashboard.getByRole('button', { name: 'Amina' }).click()
  await expect(dock(bilal).getByRole('button', { name: /micro/ })).toBeDisabled()
  await expect(dock(amina).getByRole('button', { name: /micro/ })).toBeEnabled()
  await expect(dock(bilal)).toContainText('A la parole')
  await dashboard.getByRole('button', { name: 'Rendre la parole à tous' }).click()
  await expect(dock(bilal).getByRole('button', { name: /micro/ })).toBeEnabled()

  // main levée
  await dock(bilal).getByRole('button', { name: 'Lever la main' }).click()
  await expect(dashboard).toContainText('1 main levée')
  await dashboard.getByRole('button', { name: 'Baisser' }).click()
  await expect(dashboard).not.toContainText('main levée')

  // salles : un binôme, bascule en moins de 2 s
  await dashboard.getByRole('button', { name: 'Ouvrir les salles' }).click()
  const started = Date.now()
  await prof.getByRole('button', { name: 'Ouvrir 1 salle' }).click()
  await expect(dock(amina)).toContainText('Salle 1', { timeout: 5_000 })
  await expect(dock(bilal)).toContainText('Salle 1', { timeout: 5_000 })
  const switchMs = Date.now() - started
  console.log(`bascule en salle : ${switchMs} ms`)
  expect(switchMs).toBeLessThan(2_000)
  // les deux élèves se retrouvent dans la même salle LiveKit
  await expect(dock(amina)).toContainText('Bilal')

  // le prof passe dans la salle
  await dashboard.getByRole('button', { name: 'Rejoindre' }).last().click()
  await expect(dock(amina)).toContainText('Ustadh Karim')
  await prof.screenshot({ path: 'test-results/captures/prof-tableau-de-bord.png' })
  await amina.screenshot({ path: 'test-results/captures/eleve-en-salle.png' })

  // annonce à toutes les salles
  await dashboard.getByPlaceholder(/encore 5 minutes/).fill('On inverse les rôles')
  await dashboard.getByRole('button', { name: 'Envoyer' }).click()
  await expect(amina.getByRole('alert')).toContainText('On inverse les rôles')
  await expect(bilal.getByRole('alert')).toContainText('On inverse les rôles')

  // rappel général
  await dashboard.getByRole('button', { name: 'Rappeler tout le monde' }).click()
  await expect(dock(amina)).toContainText('Salle principale')
  await expect(dock(bilal)).toContainText('Salle principale')

  // fin de séance : les panneaux se ferment
  prof.once('dialog', (d) => void d.accept())
  await dashboard.getByRole('button', { name: 'Terminer la séance' }).click()
  await expect(dock(amina)).toHaveCount(0)
  await expect(dock(bilal)).toHaveCount(0)
})

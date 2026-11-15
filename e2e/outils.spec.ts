import { expect, test, type Page } from '@playwright/test'
import { dbSelect, dock, joinFromHome, resetSessions, signIn, startSession } from './helpers.js'

/**
 * Outils du prof (phase 4) : 1 prof + 2 élèves en binôme.
 * Vue partagée et prise de main, crayon, marquage de mots, corrections du prof et du
 * binôme, validation, test « continue le verset », erreurs fréquentes, récapitulatif.
 */

const word = (page: Page, id: string) => page.locator(`main [data-w="${id}"]`).first()
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Outils de la salle' })
const nextSurahLink = (page: Page, n: number) => page.locator(`main nav a[href$="/lire/${n}"]`)

test('outils du prof : vue partagée, crayon, corrections, test, récapitulatif', async ({ browser }) => {
  test.setTimeout(120_000)
  await resetSessions()
  const prof = await signIn(browser, 'prof@halaqa.test')
  const amina = await signIn(browser, 'eleve1@halaqa.test')
  const bilal = await signIn(browser, 'eleve2@halaqa.test')
  await startSession(prof)
  await joinFromHome([amina, bilal])
  for (const p of [prof, amina, bilal]) await expect(p).toHaveURL(/\/lire\/112/)

  // salle en binôme, le prof y entre
  await expect(dock(prof)).toContainText('Amina')
  await expect(dock(prof)).toContainText('Bilal')
  await prof.keyboard.press('Alt+d')
  const dashboard = prof.getByRole('dialog', { name: /Tableau de bord/ })
  // le tableau de bord lit la base : les deux élèves y sont avant qu'on répartisse
  await expect(dashboard).toContainText('Amina')
  await expect(dashboard).toContainText('Bilal')
  await dashboard.getByRole('button', { name: 'Ouvrir les salles' }).click()
  await prof.getByRole('button', { name: 'Ouvrir 1 salle' }).click()
  await expect(dock(amina)).toContainText('Salle 1')
  await expect(dock(bilal)).toContainText('Salle 1')
  await dashboard.getByRole('button', { name: 'Rejoindre' }).last().click()
  await prof.keyboard.press('Escape')
  await expect(dock(prof)).toContainText('Salle 1')
  await expect(toolbar(prof)).toBeVisible()

  // ---- vue partagée : en entrant, le prof suit la vue d'Amina
  await expect(toolbar(prof).getByLabel('Vue suivie')).toHaveValue(/.+/)
  await nextSurahLink(amina, 113).click()
  await expect(amina).toHaveURL(/\/lire\/113/)
  await expect(prof).toHaveURL(/\/lire\/113/, { timeout: 10_000 })

  // ---- prise de main : les deux élèves suivent le prof
  await toolbar(prof).getByRole('button', { name: 'Prendre la main' }).click()
  await expect(toolbar(bilal)).toContainText('a la main')
  await expect(bilal).toHaveURL(/\/lire\/113/, { timeout: 10_000 })
  await nextSurahLink(prof, 114).click()
  await expect(amina).toHaveURL(/\/lire\/114/, { timeout: 10_000 })
  await expect(bilal).toHaveURL(/\/lire\/114/, { timeout: 10_000 })

  // ---- crayon : le trait du prof apparaît chez l'élève
  await toolbar(prof).getByRole('button', { name: 'Crayon' }).click()
  const box = (await word(prof, '114:1:3').boundingBox())!
  await prof.mouse.move(box.x + 4, box.y + box.height + 6)
  await prof.mouse.down()
  for (let i = 1; i <= 12; i++) await prof.mouse.move(box.x + 4 + i * 12, box.y + box.height + 6 + (i % 3))
  await prof.mouse.up()
  await expect(amina.locator('main [data-testid="strokes"] path')).toHaveCount(1)
  await expect.poll(async () => (await dbSelect<unknown[]>('annotations?kind=eq.stroke&select=id')).length).toBe(1)

  // ---- marquage d'un mot
  await toolbar(prof).getByRole('button', { name: 'Marquer des mots' }).click()
  await word(prof, '114:1:2').click()
  await expect(word(amina, '114:1:2')).toHaveClass(/mark-highlight-red/)

  // ---- correction du prof : le mot passe en rouge chez Amina (pas chez Bilal)
  await toolbar(prof).getByRole('button', { name: 'Corriger' }).click()
  await word(prof, '114:2:1').click()
  await prof.getByRole('dialog').getByRole('button', { name: 'Mot oublié' }).click()
  await expect(word(amina, '114:2:1')).toHaveClass(/corr-error/)
  await expect(word(bilal, '114:2:1')).not.toHaveClass(/corr-error/)

  // ---- binôme : Bilal marque une erreur d'Amina, le prof la confirme
  await toolbar(bilal).getByRole('button', { name: /Marquer les erreurs : Amina/ }).click()
  await word(bilal, '114:3:1').click()
  await bilal.getByRole('dialog').getByRole('button', { name: 'Haraka' }).click()
  await expect(word(amina, '114:3:1')).toHaveClass(/corr-pending/)
  await expect(word(prof, '114:3:1')).toHaveClass(/corr-pending/)
  await toolbar(prof).getByRole('button', { name: 'Lire' }).click()
  await word(prof, '114:3:1').click()
  await prof.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await expect(word(amina, '114:3:1')).toHaveClass(/corr-error/)
  await prof.keyboard.press('Escape')

  // ---- verset validé
  await toolbar(prof).getByRole('button', { name: 'Corriger' }).click()
  await word(prof, '114:1:1').click()
  await prof.getByRole('dialog').getByRole('button', { name: 'Verset validé' }).click()
  await expect(prof.getByRole('dialog').getByRole('status')).toContainText('114:1')
  await prof.keyboard.press('Escape')
  await prof.screenshot({ path: 'test-results/captures/prof-outils.png' })
  await amina.screenshot({ path: 'test-results/captures/eleve-corrections.png' })

  // ---- crayon autorisé à l'élève
  await expect(toolbar(amina).getByRole('button', { name: 'Crayon' })).toHaveCount(0)
  await toolbar(prof).getByLabel('Crayon aux élèves').check()
  await expect(toolbar(amina).getByRole('button', { name: 'Crayon' })).toBeVisible()

  // ---- test « continue le verset » pour Amina
  await toolbar(prof).getByRole('button', { name: 'Continue le verset' }).click()
  const quiz = amina.getByTestId('quiz')
  await expect(quiz).toContainText('poursuivez de mémoire')
  await expect(quiz).toContainText('…')
  await prof.getByTestId('quiz').getByRole('button', { name: 'Afficher le verset' }).click()
  await expect(quiz).not.toContainText('…')
  await prof.getByTestId('quiz').getByRole('button', { name: 'Terminer le test' }).click()
  await expect(quiz).toHaveCount(0)

  // ---- retour commun : les erreurs fréquentes chez tous
  await prof.keyboard.press('Alt+d')
  await dashboard.getByRole('button', { name: 'Rappeler tout le monde' }).click()
  await expect(dock(bilal)).toContainText('Salle principale')
  await dashboard.getByRole('button', { name: 'Afficher à tous' }).click()
  const summary = dock(bilal).getByRole('region', { name: 'Erreurs fréquentes de la séance' })
  await expect(summary).toContainText('2 erreurs relevées')
  await expect(summary).toContainText('Mot oublié')
  await expect(summary).toContainText('Haraka')

  // ---- fin de séance et récapitulatif
  prof.once('dialog', (d) => void d.accept())
  await dashboard.getByRole('button', { name: 'Terminer la séance' }).click()
  await amina.getByRole('button', { name: 'Voir mon récapitulatif' }).click()
  await expect(amina.getByRole('heading', { name: 'Récapitulatif de séance' })).toBeVisible()
  await expect(amina.getByText('Mot oublié')).toBeVisible()
  await expect(amina.getByText('Haraka')).toBeVisible()
  await expect(amina.getByText('114:1 · validé')).toBeVisible()
  await amina.screenshot({ path: 'test-results/captures/eleve-recapitulatif.png', fullPage: true })

  // ---- révision sur le texte après la séance
  await amina.getByRole('link', { name: 'Revoir sur le texte' }).click()
  await expect(amina.getByText(/Révision de la séance/)).toBeVisible()
  await expect(word(amina, '114:2:1')).toHaveClass(/corr-error/)
  await expect(amina.locator('main [data-testid="strokes"] path')).toHaveCount(1)
  // en mode Mushaf, le trait et les corrections restent accrochés aux mêmes mots
  await amina.getByTitle('Mode Mushaf (pages)').click()
  await expect(amina).toHaveURL(/\/page\/604/)
  await expect(word(amina, '114:2:1')).toHaveClass(/corr-error/)
  await expect(amina.locator('main [data-testid="strokes"] path')).toHaveCount(1)
  await amina.screenshot({ path: 'test-results/captures/eleve-revision-mushaf.png' })
})

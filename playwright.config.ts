import { defineConfig } from '@playwright/test'

/**
 * Scénarios de bout en bout (Supabase local + LiveKit local, cf. docs/phase-3.md).
 * Micro et caméra simulés par Chromium.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'fr-FR',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    permissions: ['microphone', 'camera'],
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
})

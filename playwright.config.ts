import { defineConfig, devices } from '@playwright/test'

// One folder per module under e2e/ (spec 10.3). Run one: `npx playwright test e2e/f01-auth --reporter=line`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    trace: 'off',
    launchOptions: {
      // Fake camera for the exam module; real face detection needs a manual session (spec F6).
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

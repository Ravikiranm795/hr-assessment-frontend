import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The demo organization has no AI provider, so the AI call itself cannot succeed (it correctly answers
// AI_NOT_CONFIGURED, which one test checks live). To walk the rest of the flow against the real backend,
// `interpret` is rewritten on the way out: the typed text is replaced by an equivalent structured
// `filter_spec`, so the backend still creates a real report and every later step (select, preview-count,
// generate, download) is live. Only two responses are fabricated: the row-cap error and the "file deleted" history row.

async function signIn(page: Page, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('DemoPass#2026')
    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes('/auth/login')), page.getByRole('button', { name: 'Sign in' }).click()])
    if (res.status() !== 429) break
    await page.waitForTimeout(2000 * (attempt + 1))
  }
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()
}

async function swapInterpretForSpec(page: Page, spec: object) {
  await page.route('**/api/v1/reports/chat/interpret', async (route) => {
    const res = await route.fetch({ postData: JSON.stringify({ filter_spec: spec }) })
    await route.fulfill({ response: res })
  })
}

const rejected = { source: 'candidates', filters: [{ field: 'decision', op: 'eq', value: 'rejected' }] }

async function askAndPick(page: Page) {
  await page.goto('/reports')
  await page.getByLabel('Describe the report').fill('Rejected candidates with their scores')
  await page.getByRole('button', { name: 'Interpret my request' }).click()
  await expect(page.getByText('Which of these did you mean?')).toBeVisible()
  await page.getByRole('button', { name: 'Use this report' }).click()
  await expect(page.getByRole('heading', { name: 'Review and generate' })).toBeVisible()
}

test('without an AI provider the interpret call reports it clearly (live)', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
  await page.getByLabel('Describe the report').fill('Rejected candidates with their scores')
  await page.getByRole('button', { name: 'Interpret my request' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'AI is not set up for your organization yet.' })).toBeVisible()
  await expect(page.getByText('Ask your organization administrator to set up an AI provider')).toBeVisible()
})

test('org admin: interpret, pick, count, columns, generate, download, history', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await swapInterpretForSpec(page, rejected)
  await page.goto('/reports')
  await page.getByLabel('Describe the report').fill('Rejected candidates with their scores')
  await page.getByRole('button', { name: 'Interpret my request' }).click()
  await expect(page.getByText('Which of these did you mean?')).toBeVisible()
  await expect(page.getByText(/about \d+ rows?/)).toBeVisible()

  // Refining goes to the AI, which is not configured here (live answer).
  await page.getByLabel('None of these? Refine your request').fill('only engineering')
  await page.getByRole('button', { name: 'Refine' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'AI is not set up' })).toBeVisible()

  await page.getByRole('button', { name: 'Use this report' }).click()
  await expect(page.getByRole('heading', { name: 'Review and generate' })).toBeVisible()
  await expect(page.getByTestId('row-count')).toContainText(/\d+ rows? will be included/)
  await page.getByRole('checkbox', { name: /Candidate email/ }).uncheck()

  await page.getByRole('button', { name: 'Generate report' }).click()
  await expect(page.getByRole('heading', { name: 'Your report is ready' })).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download', exact: true }).click()])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  const csv = readFileSync((await download.path())!, 'utf8')
  expect(csv).toContain('candidate_name')
  expect(csv).not.toContain('candidate_email')

  // The new request is in the history with a download link.
  await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Structured filter')
  await expect(page.getByRole('table').getByRole('row').nth(1).getByRole('button', { name: /^Download/ })).toBeVisible()
})

test('REPORT_FILTER_INVALID, the row cap and deleted files are explained', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')

  // 1. The backend rejects a spec with an unknown field (live 422).
  await page.route('**/api/v1/reports/chat/interpret', async (route) => {
    const res = await route.fetch({ postData: JSON.stringify({ filter_spec: { source: 'candidates', filters: [{ field: 'nope', op: 'eq', value: 'x' }] } }) })
    await route.fulfill({ response: res })
  })
  await page.goto('/reports')
  await page.getByLabel('Describe the report').fill('Something the catalog cannot answer')
  await page.getByRole('button', { name: 'Interpret my request' }).click()
  const invalid = page.getByRole('alert').filter({ hasText: 'The report filter is not valid.' })
  await expect(invalid).toBeVisible()
  await expect(invalid).toContainText('Condition 1, field: this field does not exist')
  await page.unroute('**/api/v1/reports/chat/interpret')

  // 2. The row cap (fabricated response in the backend's real error shape; cannot be reached with demo data).
  await swapInterpretForSpec(page, rejected)
  await page.route('**/api/v1/reports/*/generate', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'REPORT_FILTER_INVALID', message_key: 'errors.report.filter_invalid', details: { fields: [{ field: 'limit', code: 'row_cap_exceeded', max: 2000 }] }, request_id: 'stub' } }),
    }),
  )
  await askAndPick(page)
  await page.getByLabel(/^PDF/).check()
  await page.getByRole('button', { name: 'Generate report' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'too many rows for PDF' })).toContainText('2,000')

  // 3. A generated request whose file was removed after 7 days (history response edited).
  await page.route(/\/api\/v1\/reports\?/, async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    body.items = body.items.map((i: { status: string }) => (i.status === 'generated' ? { ...i, file_available: false } : i))
    await route.fulfill({ response: res, json: body })
  })
  await page.reload()
  await expect(page.getByRole('table').getByText('File deleted').first()).toBeVisible()
})

test('super admin builds a structured report without AI', async ({ page }) => {
  await signIn(page, 'superadmin.daily@platform.demo.example.com')
  await page.goto('/platform/reports')
  await expect(page.getByRole('heading', { name: 'Platform reports', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Describe the report')).toHaveCount(0) // no prompt, no AI

  await page.getByRole('button', { name: 'Add a condition' }).click()
  await page.getByLabel('Condition 1: field').selectOption({ label: 'Status' })
  await page.getByLabel('Value', { exact: true }).selectOption({ label: 'Active' })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Review and generate' })).toBeVisible()
  await expect(page.getByTestId('row-count')).toContainText(/\d+ rows? will be included/)
  await page.getByRole('button', { name: 'Generate report' }).click()
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download', exact: true }).click()])
  expect(csv.suggestedFilename()).toMatch(/\.csv$/)

  // A grouped count of the platform audit log, as a PDF.
  await page.getByRole('button', { name: 'Make another report' }).click()
  await page.getByLabel('Data', { exact: true }).selectOption({ label: 'Platform audit log' })
  await page.getByRole('radio', { name: 'Count of records grouped by a field' }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/One row per .* with the number of records\./)).toBeVisible()
  await expect(page.getByText('Columns', { exact: true })).toHaveCount(0)
  await page.getByLabel(/^PDF/).check()
  await page.getByRole('button', { name: 'Generate report' }).click()
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download', exact: true }).click()])
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/)
  await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Structured filter')
})

test('reports are closed to other roles, other orgs and other scopes', async ({ page }) => {
  await signIn(page, 'admin@acme.demo.example.com')
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Not available for your organization' })).toBeVisible()

  await page.context().clearCookies()
  await signIn(page, 'hana@one.demo.example.com')
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  await page.context().clearCookies()
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/platform/reports')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  await page.context().clearCookies()
  await signIn(page, 'superadmin.daily@platform.demo.example.com')
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

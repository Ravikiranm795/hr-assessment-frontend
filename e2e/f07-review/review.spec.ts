import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PASSWORD = 'DemoPass#2026'

interface Found {
  withFlags?: string
  waiting?: string
  decided?: string
}

/** Pick real attempts from the demo data through the API (no hard-coded ids). */
async function findAttempts(request: APIRequestContext): Promise<Found> {
  const login = await request.post('/api/v1/auth/login', { data: { email: 'admin@one.demo.example.com', password: PASSWORD } })
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` }
  const roles = (await (await request.get('/api/v1/roles?page_size=100', { headers })).json()).items as { id: string }[]
  const found: Found = {}
  for (const role of roles) {
    const invites = (await (await request.get(`/api/v1/roles/${role.id}/invites?page_size=100`, { headers })).json()).items as {
      attempt?: { id: string; status: string; decision?: string }
    }[]
    for (const { attempt } of invites) {
      if (!attempt || attempt.status !== 'submitted') continue
      const detail = await (await request.get(`/api/v1/attempts/${attempt.id}`, { headers })).json()
      if (detail.timeline.length > 0 && !found.withFlags) found.withFlags = attempt.id
      if (detail.decision === 'waiting' && !found.waiting) found.waiting = attempt.id
      if (detail.decision !== 'waiting' && !found.decided) found.decided = attempt.id
    }
  }
  return found
}

async function signIn(page: Page, email = 'admin@one.demo.example.com') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()
}

let ids: Found
test.beforeAll(async ({ request }) => {
  ids = await findAttempts(request)
})

test('review page shows score, decision and the answers', async ({ page }) => {
  test.skip(!ids.decided, 'no decided attempt in demo data')
  await signIn(page)
  await page.goto(`/attempts/${ids.decided}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Score' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Decision' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Override decision' })).toBeVisible() // org admin only
  await expect(page.getByRole('article').first()).toBeVisible()
  await expect(page.getByText('Access to this page is recorded.')).toBeVisible()
})

test('violations tab lists flags and opens a signed snapshot', async ({ page }) => {
  test.skip(!ids.withFlags, 'no attempt with flags in demo data')
  await signIn(page)
  await page.goto(`/attempts/${ids.withFlags}`)
  await page.getByRole('tab', { name: 'Violations' }).click()
  await expect(page.getByText(/\d+ flags recorded/)).toBeVisible()
  await page.getByRole('button', { name: 'View snapshot' }).first().click()
  await expect(page.getByRole('img', { name: 'Camera snapshot at the time of the flag' })).toBeVisible()
})

test('history tab renders', async ({ page }) => {
  test.skip(!ids.decided, 'no decided attempt in demo data')
  await signIn(page)
  await page.goto(`/attempts/${ids.decided}`)
  await page.getByRole('tab', { name: 'History' }).click()
  await expect(page.getByRole('heading', { name: 'Decision history' })).toBeVisible()
})

test('a waiting attempt asks for confirmation before deciding (cancelled, nothing saved)', async ({ page }) => {
  test.skip(!ids.waiting, 'no waiting attempt in demo data')
  await signIn(page)
  await page.goto(`/attempts/${ids.waiting}`)
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('A decision cannot be made twice')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Waiting for a decision')).toBeVisible()
})

test('an unknown attempt shows the normal not-found page', async ({ page }) => {
  await signIn(page)
  await page.goto('/attempts/00000000-0000-0000-0000-000000000000')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

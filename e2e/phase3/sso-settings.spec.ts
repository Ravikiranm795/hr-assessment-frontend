import { expect, test, type APIRequestContext } from '@playwright/test'

// Needs the backend on :8000 with the demo seed. Turns the sso_signin flag on for the demo org and restores it.
// No real sign-in is attempted: a fake issuer cannot be discovered.
const SUPER = 'superadmin.daily@platform.demo.example.com'
const ADMIN = 'admin@one.demo.example.com'
const PASSWORD = 'DemoPass#2026'

async function token(request: APIRequestContext, email: string) {
  const res = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } })
  return ((await res.json()) as { access_token: string }).access_token
}

let orgId = ''
let hadFlag = false

test.beforeAll(async ({ request }) => {
  const adminHeaders = { Authorization: `Bearer ${await token(request, ADMIN)}` }
  const me = (await (await request.get('/api/v1/auth/me', { headers: adminHeaders })).json()) as {
    organization: { id: string }
    flags: Record<string, boolean>
  }
  orgId = me.organization.id
  hadFlag = me.flags.sso_signin === true
  const superHeaders = { Authorization: `Bearer ${await token(request, SUPER)}` }
  const res = await request.put(`/api/v1/platform/orgs/${orgId}/features`, { headers: superHeaders, data: { flags: { sso_signin: true }, reason: 'e2e' } })
  expect(res.ok()).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  const adminHeaders = { Authorization: `Bearer ${await token(request, ADMIN)}` }
  await request.delete('/api/v1/org/settings/sso', { headers: adminHeaders }).catch(() => undefined)
  const superHeaders = { Authorization: `Bearer ${await token(request, SUPER)}` }
  await request.put(`/api/v1/platform/orgs/${orgId}/features`, { headers: superHeaders, data: { flags: { sso_signin: hadFlag }, reason: 'e2e restore' } })
})

test('sign-in settings: fake issuer is handled gracefully, states are right, login page is discover-driven', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()

  await page.goto('/settings/sign-in')
  await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible()
  await expect(page.getByText('Not set up')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Enable single sign-on' })).toBeDisabled()
  await expect(page.getByRole('switch', { name: 'Require single sign-on' })).toBeDisabled()
  await expect(page.getByLabel('Redirect URL')).toHaveValue(/\/api\/v1\/auth\/sso\/callback$/)

  // Missing secret is caught before any request.
  await page.getByRole('radio', { name: /Other OpenID Connect/ }).check()
  await page.getByLabel('Issuer URL').fill('https://idp.e2e-fake.example.com')
  await page.getByLabel('Client ID').fill('e2e-client')
  await page.getByLabel('Email domains').fill('one.demo.example.com')
  await page.getByLabel('Email domains').press('Enter')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('This is required.')).toBeVisible()

  // Bad domain text is rejected in the tag input.
  await page.getByLabel('Email domains').fill('not a domain!')
  await page.getByLabel('Email domains').press('Enter')
  await expect(page.getByText(/is not a valid domain/)).toBeVisible()
  await page.getByLabel('Email domains').fill('')

  // Save with a fake issuer: either saved or a friendly message, never a crash.
  await page.getByLabel('Client secret').fill('fake-secret')
  await page.getByRole('button', { name: 'Save changes' }).click()
  const saved = page.getByText('Settings saved.')
  const failed = page.getByRole('alert').filter({ hasText: /\S/ })
  await expect(saved.or(failed.first())).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible()
  const wasSaved = await saved.isVisible()
  test.info().annotations.push({ type: 'observed', description: wasSaved ? 'fake issuer saved' : 'fake issuer refused with a message' })

  if (wasSaved) {
    await expect(page.getByText('Needs test')).toBeVisible()
    await expect(page.getByLabel('Client secret')).toHaveAttribute('placeholder', 'Secret saved')
    await expect(page.getByRole('switch', { name: 'Enable single sign-on' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Test sign-in' })).toBeEnabled()
    // The fake issuer cannot be discovered: friendly banner, no navigation away.
    await page.getByRole('button', { name: 'Test sign-in' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /provider|domain|try again/i }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/settings\/sign-in/)
  }

  // Login page: an unknown domain shows no SSO button.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email').fill('someone@unknown-domain-e2e.example')
  await page.getByLabel('Email').blur()
  await page.waitForTimeout(800)
  await expect(page.getByRole('button', { name: /Continue with/ })).toHaveCount(0)
  await expect(page.getByLabel('Password')).toBeVisible()

  if (wasSaved) {
    await page.getByLabel('Email').fill('anyone@one.demo.example.com')
    await page.getByLabel('Email').blur()
    await page.waitForTimeout(800)
    const n = await page.getByRole('button', { name: /Continue with/ }).count()
    test.info().annotations.push({ type: 'observed', description: `registered domain, SSO button count (not enabled yet): ${n}` })
  }
})

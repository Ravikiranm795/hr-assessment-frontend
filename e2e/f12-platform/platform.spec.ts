import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const SUPER = 'superadmin.daily@platform.demo.example.com'
const PASSWORD = 'DemoPass#2026'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()
}

async function accessToken(request: APIRequestContext) {
  const res = await request.post('/api/v1/auth/login', { data: { email: SUPER, password: PASSWORD } })
  return ((await res.json()) as { access_token: string }).access_token
}

/** Creates an organization through the API (setup only) so the negative tests start from a known state. */
async function createOrgViaApi(request: APIRequestContext, name: string, adminEmail: string) {
  const headers = { Authorization: `Bearer ${await accessToken(request)}` }
  const res = await request.post('/api/v1/platform/orgs', { headers, data: { name, admin: { name: 'Setup Admin', email: adminEmail } } })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { organization: { id: string } }).organization.id
}

async function disableViaApi(request: APIRequestContext, id: string) {
  const headers = { Authorization: `Bearer ${await accessToken(request)}` }
  await request.post(`/api/v1/platform/orgs/${id}/disable`, { headers })
}

test('golden flow: create an organization, toggle a flag, raise and clear a misuse flag, disable and enable', async ({ page }) => {
  const stamp = Date.now()
  const name = `E2E Platform ${stamp}`
  await signIn(page, SUPER)
  await page.goto('/platform/orgs')
  await expect(page.getByRole('heading', { name: 'Organizations', level: 1 })).toBeVisible()

  // Create with the first admin; the temporary password is shown once.
  await page.getByRole('button', { name: 'Create organization' }).click()
  await page.getByLabel('Organization name').fill(name)
  await page.getByLabel('Admin full name').fill('First Admin')
  await page.getByLabel('Admin work email').fill(`first.${stamp}@e2e-platform.example.com`)
  await page.getByRole('dialog').getByRole('button', { name: 'Create organization' }).click()
  const temp = page.getByRole('dialog', { name: 'Temporary password' })
  await expect(temp).toBeVisible()
  await expect(temp.getByTestId('temp-password')).not.toBeEmpty()
  await temp.getByRole('button', { name: 'I have shared it' }).click()
  await expect(temp).toHaveCount(0)

  await page.getByLabel('Search by name or slug').fill(String(stamp))
  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()

  // Overview shows the counts; the new organization has one admin.
  await expect(page.getByText('Organization admins')).toBeVisible()

  // Feature flags: the watermark flag is listed, toggle one flag and save.
  const tabs = page.getByRole('navigation', { name: 'Organization sections' })
  await tabs.getByRole('link', { name: 'Feature flags' }).click()
  await expect(page.getByRole('switch', { name: 'Platform watermark' })).toBeChecked()
  const team = page.getByRole('switch', { name: 'Team', exact: true })
  await expect(team).toBeChecked()
  await team.setChecked(false, { force: true })
  await page.getByRole('button', { name: /Save changes \(1\)/ }).click()
  await expect(page.getByText('Feature flags saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Team', exact: true })).not.toBeChecked()

  // Misuse flag: raise with a comment, then clear with a closing note.
  await tabs.getByRole('link', { name: 'Misuse flags' }).click()
  await page.getByRole('button', { name: 'Raise misuse flag' }).click()
  await page.getByLabel('Comment (required)').fill('Candidate links were posted publicly')
  await page.getByRole('button', { name: 'Raise flag' }).click()
  const table = page.getByRole('table')
  await expect(table.getByText('Candidate links were posted publicly')).toBeVisible()
  await expect(table.getByText('Open', { exact: true })).toBeVisible()
  await table.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByLabel('Closing note (required)').fill('Resolved with the customer')
  await page.getByRole('button', { name: 'Clear flag' }).click()
  await expect(table.getByText('Cleared', { exact: true })).toBeVisible()
  await expect(table.getByText('Closing note: Resolved with the customer')).toBeVisible()

  // Disable, then enable, then leave it disabled.
  await page.getByRole('button', { name: 'Disable organization' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Disable organization' }).click()
  await expect(page.getByRole('button', { name: 'Enable organization' })).toBeVisible()
  await page.getByRole('button', { name: 'Enable organization' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable organization' }).click()
  await expect(page.getByRole('button', { name: 'Disable organization' })).toBeVisible()
  await page.getByRole('button', { name: 'Disable organization' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Disable organization' }).click()
  await expect(page.getByRole('button', { name: 'Enable organization' })).toBeVisible()
})

test.describe('with a fixture organization', () => {
  const stamp = Date.now()
  let orgId = ''

  test.beforeAll(async ({ request }) => {
    orgId = await createOrgViaApi(request, `E2E Fixture ${stamp}`, `fixture.${stamp}@e2e-platform.example.com`)
  })
  test.afterAll(async ({ request }) => {
    if (orgId) await disableViaApi(request, orgId)
  })

  test('org admins: reset password shows a new one-time password, last admin needs a second confirmation', async ({ page }) => {
    await signIn(page, SUPER)
    await page.goto(`/platform/orgs/${orgId}/admins`)
    const row = page.getByRole('row', { name: /Setup Admin/ })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Actions for Setup Admin' }).click()
    await page.getByRole('menuitem', { name: 'Reset password' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reset password' }).click()
    const temp = page.getByRole('dialog', { name: 'Temporary password' })
    await expect(temp.getByTestId('temp-password')).not.toBeEmpty()
    await temp.getByRole('button', { name: 'I have shared it' }).click()

    await row.getByRole('button', { name: 'Actions for Setup Admin' }).click()
    await page.getByRole('menuitem', { name: 'Deactivate' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate', exact: true }).click()
    // The only active admin: the server answers LAST_ADMIN_PROTECTED and the UI asks again.
    await expect(page.getByRole('alertdialog', { name: 'Deactivate the last active admin?' })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate anyway' }).click()
    await expect(row.getByText('Inactive')).toBeVisible()

    await row.getByRole('button', { name: 'Actions for Setup Admin' }).click()
    await page.getByRole('menuitem', { name: 'Reactivate' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivate' }).click()
    await expect(row.getByText('Active', { exact: true })).toBeVisible()
  })

  test('misuse comment is mandatory', async ({ page }) => {
    await signIn(page, SUPER)
    await page.goto(`/platform/orgs/${orgId}/misuse`)
    await page.getByRole('button', { name: 'Raise misuse flag' }).click()
    await page.getByRole('button', { name: 'Raise flag' }).click()
    await expect(page.getByText('This field is required.')).toBeVisible()
  })

  test('a flag change persists after reload', async ({ page }) => {
    await signIn(page, SUPER)
    await page.goto(`/platform/orgs/${orgId}/flags`)
    const flag = page.getByRole('switch', { name: 'Camera proctoring' })
    await expect(flag).toBeChecked()
    await flag.setChecked(false, { force: true })
    await expect(page.getByText('Unsaved')).toBeVisible()
    await page.getByRole('button', { name: /Save changes \(1\)/ }).click()
    await expect(page.getByText('Feature flags saved.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('switch', { name: 'Camera proctoring' })).not.toBeChecked()
  })
})

test('an unknown organization id shows the normal not-found page', async ({ page }) => {
  await signIn(page, SUPER)
  await page.goto('/platform/orgs/00000000-0000-0000-0000-000000000000/overview')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

for (const [label, email] of [
  ['an organization admin', 'admin@one.demo.example.com'],
  ['an HR user', 'hana@one.demo.example.com'],
] as const) {
  test(`${label} cannot open the platform organizations page`, async ({ page }) => {
    await signIn(page, email)
    await page.goto('/platform/orgs')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
}

test('platform branding rejects a primary color with too little contrast and never saves it', async ({ page }) => {
  await signIn(page, SUPER)
  await page.goto('/platform/branding')
  await expect(page.getByRole('heading', { name: 'Platform branding', level: 1 })).toBeVisible()
  const save = page.getByRole('button', { name: 'Save theme' })
  await expect(save).toBeEnabled()
  await page.getByLabel('Primary color', { exact: true }).fill('#808080')
  await expect(page.getByText('needs 4.5:1')).toBeVisible()
  await expect(save).toBeDisabled()
})

test('default flags page lists every flag including the watermark', async ({ page }) => {
  await signIn(page, SUPER)
  await page.goto('/platform/flags/defaults')
  await expect(page.getByRole('heading', { name: 'Default feature flags', level: 1 })).toBeVisible()
  await expect(page.getByRole('switch')).toHaveCount(22)
  await expect(page.getByRole('switch', { name: 'Platform watermark' })).toBeVisible()
})

test('usage page shows AI usage per organization for a month', async ({ page }) => {
  await signIn(page, SUPER)
  await page.goto('/platform/usage')
  await expect(page.getByRole('heading', { name: 'AI usage', level: 1 })).toBeVisible()
  await expect(page.getByRole('row', { name: /MRK Innovations/ })).toBeVisible()
})

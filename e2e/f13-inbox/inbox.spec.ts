import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PASSWORD = 'DemoPass#2026'

// Login is rate limited and the demo database is shared, so wait and retry on 429.
async function signIn(page: Page, email: string) {
  await page.goto('/login')
  const nav = page.getByRole('navigation', { name: 'Main menu' })
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    if (await nav.waitFor({ timeout: 4000 }).then(() => true, () => false)) return
    await page.waitForTimeout(7000)
  }
  await nav.waitFor()
}

let hrToken: string | undefined
async function hrAuth(request: APIRequestContext) {
  for (let attempt = 0; !hrToken && attempt < 8; attempt += 1) {
    const login = await request.post('/api/v1/auth/login', { data: { email: 'hana@one.demo.example.com', password: PASSWORD } })
    if (login.ok()) hrToken = ((await login.json()) as { access_token: string }).access_token
    else await new Promise((resolve) => setTimeout(resolve, 7000))
  }
  return { headers: { Authorization: `Bearer ${hrToken}` } }
}

/** Own data: a fresh open role and invite, then a help request raised from the candidate side. */
async function seedHelpRequest(request: APIRequestContext, note: string) {
  const auth = await hrAuth(request)
  const role = (await (await request.post('/api/v1/roles', { ...auth, data: { title: `E2E inbox ${Date.now()}`, vacancies: 1 } })).json()) as { id: string }
  const list = await request.get('/api/v1/assessments?linkable=true&page_size=1', auth)
  const version = ((await list.json()) as { items: { latest_published_version_id: string }[] }).items[0].latest_published_version_id
  await request.put(`/api/v1/roles/${role.id}/assessment`, { ...auth, data: { assessment_version_id: version } })
  await request.post(`/api/v1/roles/${role.id}/open`, auth)
  const name = `Helper ${Date.now().toString(36)}`
  const invite = (await (
    await request.post(`/api/v1/roles/${role.id}/invites`, { ...auth, data: { candidate_name: name, email: `${name.replace(' ', '.')}@candidates.example.com` } })
  ).json()) as { exam_url: string }
  const opened = await request.post('/api/v1/exam/session/open', { data: { token: invite.exam_url.split('/').pop() } })
  const session = (await opened.json()) as { session_token: string }
  await request.post('/api/v1/exam/help-requests', {
    headers: { Authorization: `Bearer ${session.session_token}` },
    data: { reason: 'camera_not_working', note },
  })
  return { name, roleId: role.id }
}

test('the inbox lists requests, filters by status, and approves one', async ({ page, request }) => {
  const seeded = await seedHelpRequest(request, 'e2e approve me')
  await signIn(page, 'hana@one.demo.example.com')
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Help requests' }).click()
  await expect(page).toHaveURL(/\/help-requests$/)
  await expect(page.getByRole('heading', { name: 'Help requests' })).toBeVisible()

  const row = page.getByRole('row', { name: new RegExp(seeded.name) })
  await expect(row).toContainText('Camera not working')
  await expect(row).toContainText('Pending')
  await row.getByRole('button', { name: 'Approve' }).click()
  await page.getByLabel('Extra minutes').fill('5')
  await page.getByLabel('Note (optional)').fill('Approved by e2e')
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('The request was approved.')).toBeVisible()

  await page.getByLabel('Status').selectOption('approved')
  await expect(page.getByRole('row', { name: new RegExp(seeded.name) })).toContainText('Approved')
  await page.getByLabel('Status').selectOption('open')
  await expect(page.getByRole('row', { name: new RegExp(seeded.name) })).toHaveCount(0)
})

test('declining needs a note', async ({ page, request }) => {
  const seeded = await seedHelpRequest(request, 'e2e decline me')
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/help-requests')
  const row = page.getByRole('row', { name: new RegExp(seeded.name) })
  await row.getByRole('button', { name: 'Decline' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Decline' }).click()
  await expect(page.getByText('This field is required.')).toBeVisible()
  await page.getByLabel('Note for the candidate (required)').fill('Please retry with another browser')
  await page.getByRole('dialog').getByRole('button', { name: 'Decline' }).click()
  await expect(page.getByText('The request was declined.')).toBeVisible()
  await page.getByLabel('Status').selectOption('declined')
  await expect(page.getByRole('row', { name: new RegExp(seeded.name) })).toContainText('Declined')
})

test('a pending request also shows on its role page and can be approved there', async ({ page, request }) => {
  const seeded = await seedHelpRequest(request, 'e2e from role page')
  await signIn(page, 'hana@one.demo.example.com')
  await page.goto(`/roles/${seeded.roleId}`)
  await expect(page.getByRole('heading', { name: /pending help request/ })).toBeVisible()
  await expect(page.getByText(`${seeded.name} · Camera not working`)).toBeVisible()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('The request was approved.')).toBeVisible()
  await expect(page.getByRole('heading', { name: /pending help request/ })).toHaveCount(0)
})

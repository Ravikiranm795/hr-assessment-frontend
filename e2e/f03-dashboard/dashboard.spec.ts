import { expect, test, type Page } from '@playwright/test'

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

test('org admin dashboard shows gadget cards with data', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Candidates at a glance' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Decisions' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Candidates per week' })).toBeVisible()
  // a number in the summary gadget is a link to the list behind it
  await expect(page.getByRole('region', { name: 'Candidates at a glance' }).getByRole('link').first()).toBeVisible()
})

test('HR dashboard includes the HR-only gadget but not admin gadgets', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  await expect(page.getByRole('region', { name: 'My assessments' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Security events' })).toHaveCount(0)
})

test('super admin gets the platform dashboard', async ({ page }) => {
  await signIn(page, 'superadmin.daily@platform.demo.example.com')
  await expect(page.getByRole('heading', { name: 'Platform dashboard', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Platform usage' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Organizations' })).toBeVisible()
})

test('hiding a gadget in Settings removes it from the dashboard, and it can be restored', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  await page.goto('/settings/dashboard')
  const quick = page.getByLabel('Show: Quick actions')
  await quick.check() // self-healing: a previously failed run may have left it off
  await quick.uncheck()
  await page.getByRole('button', { name: 'Save layout' }).click()
  await expect(page.getByText('Layout saved.')).toBeVisible()
  await page.goto('/')
  // Wait for the dashboard to be loaded before asserting absence: an instant "0" proves nothing, and
  // navigating away mid-refresh would reuse a rotated refresh token and end the session.
  await expect(page.getByRole('region', { name: 'Candidates at a glance' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quick actions' })).toHaveCount(0)

  await page.goto('/settings/dashboard')
  await page.getByLabel('Show: Quick actions').check()
  await page.getByRole('button', { name: 'Save layout' }).click()
  await expect(page.getByText('Layout saved.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Quick actions' })).toBeVisible()
})

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

test('org admin sees the audit log with readable action names', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/audit')
  await expect(page.getByRole('heading', { name: 'Audit log', level: 1 })).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  await expect(page.getByText('AUTH_LOGIN_SUCCESS')).toHaveCount(0) // shown as "Signed in", not the raw code
})

test('result filter narrows the list and the detail view opens', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/audit')
  await page.getByLabel('Result').selectOption('failure')
  await expect(page.getByRole('row').nth(1)).toBeVisible()
  await expect(page.getByRole('table').getByText('Success', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^View:/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Audit entry' })).toBeVisible()
  await expect(page.getByText('Sensitive values are hidden.')).toBeVisible()
})

test('security events tab lists failed sign-ins', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/audit')
  await page.getByRole('tab', { name: 'Security events' }).click()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
})

test('export downloads a CSV of the current view', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/audit')
  await page.getByRole('button', { name: 'Export' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
})

test('HR users cannot open the audit log; the super admin gets the platform view', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  await page.goto('/audit')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.context().clearCookies()
  await signIn(page, 'superadmin.daily@platform.demo.example.com')
  await page.goto('/platform/audit')
  await expect(page.getByRole('heading', { name: 'Platform audit log', level: 1 })).toBeVisible()
  await expect(page.getByRole('row').nth(1)).toBeVisible()
})

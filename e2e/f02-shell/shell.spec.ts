import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass#2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
}
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main menu' })

test('org admin sees every staff tab', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  for (const name of ['Dashboard', 'Assessments', 'Open roles', 'Help requests', 'Reports', 'Audit', 'Team', 'Settings']) {
    await expect(mainNav(page).getByRole('link', { name })).toBeVisible()
  }
})

test('HR user menu hides admin-only tabs', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  await expect(mainNav(page).getByRole('link', { name: 'Assessments' })).toBeVisible()
  for (const name of ['Reports', 'Audit', 'Team']) {
    await expect(mainNav(page).getByRole('link', { name })).toHaveCount(0)
  }
})

test('organization theme from /auth/me is applied after sign-in and cleared on sign-out', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  const primary = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--color-primary'))
  await expect.poll(primary).toBe('#0F4C5C')
  await page.getByRole('button', { name: 'Profile menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await primary()).toBe('')
})

test('Settings opens the submenu rail and the hamburger returns to the main page', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await mainNav(page).getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  const sub = page.getByRole('navigation', { name: 'Section menu' })
  await expect(sub.getByRole('link', { name: 'Branding' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open main menu' })).toBeVisible() // rail is showing
  await page.reload() // URL reflects the open submenu
  await expect(sub.getByRole('link', { name: 'Branding' })).toBeVisible()
  await page.getByRole('button', { name: 'Open main menu' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(sub).toHaveCount(0)
  await expect(mainNav(page).getByRole('link', { name: 'Settings' })).toContainText('Settings')
})

test('super admin lands on the platform dashboard with the platform menu', async ({ page }) => {
  await signIn(page, 'superadmin.daily@platform.demo.example.com')
  await expect(page).toHaveURL(/\/platform\/dashboard$/)
  for (const name of ['Dashboard', 'Organizations', 'Feature flags', 'Platform branding', 'Platform audit', 'Usage', 'Platform reports']) {
    await expect(mainNav(page).getByRole('link', { name })).toBeVisible()
  }
  await expect(mainNav(page).getByRole('link', { name: 'Assessments' })).toHaveCount(0)
})

test('notification bell shows the unread count', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  const bell = page.getByRole('button', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName(/unread/)
  await bell.click()
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
})

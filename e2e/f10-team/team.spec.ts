import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass#2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()
}

test('org admin sees the team; administrator rows are read-only', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Team' }).click()
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible()
  const adminRow = page.getByRole('row', { name: /Asha Menon/ })
  await expect(adminRow.getByText('Read only')).toBeVisible()
  await expect(page.getByRole('row', { name: /Hana Recruiter/ }).getByRole('button', { name: /Actions for Hana/ })).toBeVisible()
})

test('HR user cannot open the team page', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  await page.goto('/team')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('add dialog requires both fields', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/team')
  await page.getByRole('button', { name: 'Add HR user' }).click()
  await page.getByRole('button', { name: 'Create user' }).click()
  await expect(page.getByText('This field is required.')).toHaveCount(2)
})

test('create an HR user, see the one-time password, then deactivate them', async ({ page }) => {
  const stamp = Date.now()
  const name = `E2E Tester ${stamp}`
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/team')
  await page.getByRole('button', { name: 'Add HR user' }).click()
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Work email').fill(`e2e.${stamp}@one.demo.example.com`)
  await page.getByRole('button', { name: 'Create user' }).click()

  const dialog = page.getByRole('dialog', { name: 'Temporary password' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('p.font-mono')).not.toBeEmpty()
  await dialog.getByRole('button', { name: 'I have shared it' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByLabel('Search by name or email').fill(String(stamp))
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name: 'Deactivate' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate', exact: true }).click()
  await expect(row.getByText('Inactive')).toBeVisible()
})

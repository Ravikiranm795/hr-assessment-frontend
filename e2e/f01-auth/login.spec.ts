import { expect, test } from '@playwright/test'

const PASSWORD = 'DemoPass#2026'

async function signIn(page: import('@playwright/test').Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('signed-out visitors are sent to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Powered by MRK Innovations')).toBeVisible()
})

test('HR user signs in and the session survives a page reload', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.reload() // token lives in memory only; the refresh cookie restores it quietly
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('wrong password shows the generic message, not which part was wrong', async ({ page }) => {
  await signIn(page, 'hana@one.demo.example.com', 'definitely-wrong')
  await expect(page.getByRole('alert')).toHaveText('The email or password is not correct.')
  await expect(page).toHaveURL(/\/login$/)
})

test('empty form reports required fields', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('This field is required.')).toHaveCount(2)
})

test('phone-sized screens only see the laptop message', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Please use a laptop or desktop' })).toBeVisible()
})

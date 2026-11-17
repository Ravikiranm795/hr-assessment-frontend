import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('DemoPass#2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()
}
const sub = (page: Page) => page.getByRole('navigation', { name: 'Section menu' })

test('settings menu: admin sees every section, HR only profile and gadgets', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings\/profile$/)
  for (const name of ['Profile', 'Security', 'Retention', 'Invites', 'Email', 'AI setup', 'Branding']) {
    await expect(sub(page).getByRole('link', { name })).toBeVisible()
  }
  await page.context().clearCookies()
  await signIn(page, 'hana@one.demo.example.com')
  await page.goto('/settings')
  await expect(sub(page).getByRole('link', { name: 'Profile' })).toBeVisible()
  await expect(sub(page).getByRole('link', { name: 'Security' })).toHaveCount(0)
})

test('retention: out-of-range value is rejected, a valid one saves', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/settings/retention')
  const input = page.getByLabel('Keep candidate data for (days)')
  await expect(input).toHaveValue(/\d+/)
  const original = await input.inputValue()
  await input.fill('3')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible() // server field error
  // A valid, different value saves; then put the original back (an unchanged form keeps Save disabled).
  const changed = String(Number(original) + 1)
  await input.fill(changed)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Settings saved.')).toBeVisible()
  // The page refetches and resets the form after a save; Save disables again once it has settled.
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await expect(input).toHaveValue(changed)
  await input.fill(original)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await expect(input).toHaveValue(original)
})

test('email: password is write-only and the saved state is shown without a value', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/settings/email')
  await expect(page.getByLabel('Password')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Send test' })).toBeDisabled() // not configured in the demo
})

test('AI setup: provider list loads and a default model is preselected', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/settings/ai')
  await page.getByLabel('Provider').selectOption({ label: 'Claude (Anthropic)' })
  await expect(page.getByLabel('Model')).toHaveValue('claude-haiku-5-5')
  await expect(page.getByLabel('API key')).toHaveValue('')
})

test('documents: create a document, write a version, publish it', async ({ page }) => {
  const name = `E2E policy ${Date.now()}`
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/settings/documents')
  await expect(page.getByRole('row', { name: /Privacy notice/ })).toBeVisible() // seeded
  await page.getByRole('button', { name: 'New document' }).click()
  await page.getByLabel('Title').fill(name)
  await page.getByRole('button', { name: 'Create document' }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'New version' }).click()
  await page.getByRole('textbox').last().fill('I agree to the terms of this e2e document.')
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await expect(page.getByText('Draft version saved.')).toBeVisible()
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Version published.')).toBeVisible()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
})

test('branding: low-contrast colors are flagged and cannot be saved', async ({ page }) => {
  await signIn(page, 'admin@one.demo.example.com')
  await page.goto('/settings/branding')
  const primary = page.getByLabel('Primary color').and(page.locator('input[type=text], input:not([type])'))
  await expect(primary).toHaveValue(/#[0-9A-Fa-f]{6}/)
  await expect(page.getByText(/Readable/).first()).toBeVisible()
  await primary.fill('#777777') // mid gray: neither white nor black text reaches AA on it
  await expect(page.getByText(/Too low/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

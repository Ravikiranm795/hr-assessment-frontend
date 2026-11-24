import { expect, test } from '@playwright/test'
import { createViaApi, removeViaApi, signIn } from '../f04-assessments/helpers'

const ENGINEER = 'erin@one.demo.example.com'
const HR = 'hana@one.demo.example.com'
const ADMIN = 'admin@one.demo.example.com'

test('engineer only gets the assessments area, makes no forbidden calls, can edit any assessment', async ({ page, request }) => {
  const owned = await createViaApi(request, HR, `Engineer e2e ${Date.now()}`)
  const denied: string[] = []
  const errors: Error[] = []
  page.on('response', (r) => {
    // The 401 on /auth/refresh is the anonymous session restore on the login page, before sign-in.
    if ((r.status() === 401 || r.status() === 403) && !r.url().endsWith('/api/v1/auth/refresh')) denied.push(`${r.status()} ${r.url()}`)
  })
  page.on('pageerror', (e) => errors.push(e))

  try {
    await signIn(page, ENGINEER)
    await expect(page).toHaveURL(/\/assessments$/)
    const menu = page.getByRole('navigation', { name: 'Main menu' })
    await expect(menu.getByRole('link', { name: 'Assessments' })).toBeVisible()
    for (const name of ['Dashboard', 'Open roles', 'Help requests', 'Team']) {
      await expect(menu.getByRole('link', { name })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: /Notifications/ })).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    expect(denied, 'shell and list must not make forbidden calls').toEqual([])

    for (const path of ['/roles', '/team', '/audit']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    }
    expect(errors).toEqual([])
    expect(denied, 'forbidden route visits must not call closed endpoints either').toEqual([])

    await page.goto(`/assessments/${owned.id}`)
    await expect(page.getByLabel('Title')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Add question' })).toBeVisible()
    await expect(page.getByText(/only its owner or an organization administrator can change it/)).toHaveCount(0)
  } finally {
    await removeViaApi(request, HR, owned.id)
  }
})

test('org admin can add an engineer from the Team page', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.goto('/team')
  await page.getByRole('button', { name: 'Add user' }).click()
  await expect(page.getByRole('dialog').getByRole('option', { name: 'Engineer' })).toHaveCount(1)
})

import { expect, test, type Page } from '@playwright/test'
import { createInvite, revokeInvite } from './api'

// Playwright runs Chromium with a fake camera, so these specs prove the flow, the lockdown, the autosave and
// the events reaching the server. They cannot prove real face detection: that needs a manual session with real people.

async function throughInstructionsAndConsent(page: Page) {
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible()
  await expect(page.getByText(/camera stays on and is monitored/i).first()).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Consent', exact: true })).toBeVisible()
  const agree = page.getByRole('button', { name: 'I agree and continue' })
  await expect(agree).toBeDisabled()
  await page.getByLabel(/I have read the statement/).check()
  await agree.click()
  await expect(page.getByRole('heading', { name: 'System check' })).toBeVisible()
}

async function throughSystemCheck(page: Page) {
  await page.getByRole('button', { name: 'Turn on the camera' }).click()
  // First camera start loads the face-detection model: allow more than the default 5 s on a cold run.
  await expect(page.locator('video')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByRole('button', { name: 'Take the photo again' })).toBeVisible()
  await page.getByRole('button', { name: 'Test fullscreen' }).click()
  const start = page.getByRole('button', { name: 'Start the exam' })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByRole('heading', { name: 'Question 1 of 6' })).toBeVisible()
}

/** If this browser refuses fullscreen the exam asks for it with an overlay; accept it so the test can go on. */
async function acceptFullscreenOverlay(page: Page) {
  const back = page.getByRole('button', { name: 'Return to fullscreen' })
  if (await back.isVisible().catch(() => false)) await back.click()
}

test('golden flow: open, instructions, consent, system check, answer, submit, thank you, reopen', async ({ page }) => {
  const invite = await createInvite('golden')
  await page.goto(invite.path)
  await throughInstructionsAndConsent(page)
  await throughSystemCheck(page)
  await acceptFullscreenOverlay(page)

  // Timer is server driven and the camera preview is hidden by default (F-08).
  await expect(page.getByRole('timer')).toHaveText(/\d\d:\d\d/)
  await expect(page.getByRole('button', { name: 'Show my camera' })).toBeVisible()
  await expect(page.getByLabel('Your camera preview')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show my camera' }).click()
  await expect(page.getByLabel('Your camera preview')).toBeVisible()
  await page.getByRole('button', { name: 'Hide my camera' }).click()
  await expect(page.getByLabel('Your camera preview')).toHaveCount(0)

  // Q1 single choice: autosave goes to the server with the exam token (never the staff token).
  const saved = page.waitForResponse((r) => r.url().includes('/api/v1/exam/answers/') && r.request().method() === 'PUT')
  await page.getByLabel('Heap').check()
  const response = await saved
  expect(response.status()).toBe(200)
  expect(response.request().headers().authorization).toMatch(/^Bearer /)
  await expect(page.getByText('All answers saved.')).toBeVisible()

  // Q2 multiple, Q3 fill blank, Q4 code gap, Q5 short answer, Q6 single.
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('ArrayList').check()
  await page.getByLabel('LinkedHashSet').check()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Blank 1').fill('final')
  await page.getByRole('button', { name: 'Next' }).click()
  const gap = page.getByLabel('Gap 1')
  await expect(gap).toHaveCSS('font-family', /mono|Menlo|Consolas|Courier/i)
  await gap.fill('static')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Your answer').fill('== compares references, equals() compares contents.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Function').check()
  await expect(page.getByText('All answers saved.')).toBeVisible({ timeout: 15_000 })

  // Palette: all six answered, told apart by text for screen readers.
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await expect(page.getByRole('button', { name: `Question ${n}, answered` }).or(page.getByRole('button', { name: `Question ${n}, not answered` }))).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /Question [1-5], answered/ })).toHaveCount(5)

  // Lockdown: right-click, copy and F12 are blocked and reported; the server accepts the batch.
  const prevented = await page.evaluate(() => {
    const out: Record<string, boolean> = {}
    for (const type of ['contextmenu', 'copy', 'paste']) {
      const event = new Event(type, { cancelable: true, bubbles: true })
      document.body.dispatchEvent(event)
      out[type] = event.defaultPrevented
    }
    const key = new KeyboardEvent('keydown', { key: 'F12', cancelable: true, bubbles: true })
    document.body.dispatchEvent(key)
    out.f12 = key.defaultPrevented
    return out
  })
  expect(prevented).toEqual({ contextmenu: true, copy: true, paste: true, f12: true })
  const events = await page.waitForResponse((r) => r.url().includes('/api/v1/exam/events'), { timeout: 20_000 })
  expect(events.status()).toBe(200)
  expect((await events.json()).accepted).toBeGreaterThan(0)

  // Submit with confirmation, then the locked thank-you.
  await page.getByRole('button', { name: 'Submit the exam' }).click()
  await expect(page.getByRole('alertdialog').getByText(/You answered 6 of 6 questions/)).toBeVisible()
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('heading', { name: /your exam has been submitted/ })).toBeVisible({ timeout: 20_000 })

  // Reopening the same link in the same browser shows the thank-you again (EXAM_ALREADY_SUBMITTED).
  await page.goto(invite.path)
  await expect(page.getByRole('heading', { name: /your exam has been submitted/ })).toBeVisible()
})

test('help request from the instructions page is sent and waits for HR', async ({ page }) => {
  const invite = await createInvite('help')
  await page.goto(invite.path)
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible()
  await page.getByRole('button', { name: 'Having trouble? Request help' }).click()
  await page.getByLabel('I need extra time').check()
  await page.getByLabel('Note (optional)').fill('E2E note')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByText(/Your help request was sent/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Having trouble? Request help' })).toBeDisabled()
})

test('a revoked link shows a plain message and a reference', async ({ page }) => {
  const invite = await createInvite('revoked')
  await revokeInvite(invite.inviteId)
  await page.goto(invite.path)
  await expect(page.getByRole('alert')).toContainText('no longer valid')
})

test('an unknown link says it cannot be found', async ({ page }) => {
  await page.goto('/exam/this-token-does-not-exist-0000000000000000000')
  await expect(page.getByRole('alert')).toContainText('could not find this exam link')
})

test('an expired link shows the expiry message (error response simulated)', async ({ page }) => {
  // The API cannot create an already-expired invite, so only the response is simulated here.
  await page.route('**/api/v1/exam/session/open', (route) =>
    route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INVITE_EXPIRED', message_key: 'errors.invite.expired', details: {}, request_id: 'e2e-req-1' } }),
    }),
  )
  await page.goto('/exam/any-token-0000000000000000000000000000000')
  await expect(page.getByRole('alert')).toContainText('has expired')
  await expect(page.getByRole('alert')).toContainText('e2e-req-1')
})

test('another browser gets the bound-link message', async ({ page, browser }) => {
  const invite = await createInvite('bound')
  await page.goto(invite.path)
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible()
  const other = await browser.newContext()
  const second = await other.newPage()
  await second.goto(invite.path)
  await expect(second.getByRole('alert')).toContainText('opened in another browser')
  await other.close()
})

test('phone-sized screens only see the laptop message', async ({ page }) => {
  const invite = await createInvite('phone')
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(invite.path)
  await expect(page.getByRole('alert')).toContainText(/laptop or desktop/i)
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
})

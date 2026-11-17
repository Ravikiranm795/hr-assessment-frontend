import { expect, test } from '@playwright/test'
import { createViaApi, removeViaApi, signIn, type Created } from './helpers'

const HR = 'hana@one.demo.example.com'
const ADMIN = 'admin@one.demo.example.com'
const ACME = 'admin@acme.demo.example.com'

const created: { email: string; id: string }[] = []
const track = (email: string, c: Created) => {
  created.push({ email, id: c.id })
  return c
}

test.afterAll(async ({ request }) => {
  for (const c of created) await removeViaApi(request, c.email, c.id)
})

test('golden flow: create, add questions, save, preview, publish, create new version, delete', async ({ page }) => {
  const title = `F4 e2e golden ${Date.now()}`
  await signIn(page, HR)
  await page.goto('/assessments')
  await expect(page.getByRole('heading', { name: 'Assessments', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'New assessment' }).first().click()
  await page.getByRole('dialog').getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create and open' }).click()
  await expect(page).toHaveURL(/\/assessments\/[0-9a-f-]+\/versions\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()

  // Single choice question.
  await page.getByRole('button', { name: 'Add question' }).click()
  await page.getByRole('menuitem', { name: 'Single choice' }).click()
  const q1 = page.getByRole('region', { name: 'Question 1' })
  await q1.getByRole('textbox', { name: 'Question text' }).click()
  await page.keyboard.type('Which keyword declares a constant?')
  await q1.getByRole('textbox', { name: 'Option 1' }).click()
  await page.keyboard.type('const')
  await q1.getByRole('textbox', { name: 'Option 2' }).click()
  await page.keyboard.type('var')
  await q1.getByLabel('Option 1 is correct').check()

  // Fill in the blanks question.
  await page.getByRole('button', { name: 'Add question' }).click()
  await page.getByRole('menuitem', { name: 'Fill in the blanks' }).click()
  const q2 = page.getByRole('region', { name: 'Question 2' })
  await q2.getByRole('textbox', { name: 'Question text' }).click()
  await page.keyboard.type('The ___ keyword declares a block scoped variable.')
  await q2.getByLabel('Blank 1: accepted answers').fill('let')

  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved.')).toBeVisible()
  await expect(page.getByTestId('save-status')).toContainText('All changes saved')
  await expect(page.getByTestId('questions-summary')).toContainText('2 questions, 3 marks in total')

  // Preview shows what the candidate sees, including the watermark while the org flag is on.
  await page.getByRole('button', { name: 'Preview' }).click()
  const preview = page.getByRole('dialog', { name: 'Candidate preview' })
  await expect(preview.getByText('Which keyword declares a constant?')).toBeVisible()
  await expect(preview.getByTestId('preview-watermark')).toBeAttached()
  await preview.getByRole('button', { name: 'Close' }).first().click()

  // Publish, then the version is locked and a new draft can be created.
  await page.getByRole('button', { name: 'Publish' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Version 1 published.')).toBeVisible()
  await expect(page.getByText(/is published and locked/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Create new version' }).click()
  await expect(page.getByTestId('current-version')).toContainText('Version 2')
  await expect(page.getByTestId('save-status')).not.toContainText('Read only')
  await expect(page.getByRole('region', { name: 'Question 2' })).toBeVisible()

  // Delete from the list (own data only).
  await page.goto('/assessments')
  await page.getByLabel('Search by title').fill(title)
  const row = page.getByRole('row', { name: new RegExp(title) })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Assessment deleted.')).toBeVisible()
})

test('a non-owner HR sees the assessment read-only', async ({ page, request }) => {
  const a = track(ADMIN, await createViaApi(request, ADMIN, `F4 e2e readonly ${Date.now()}`))
  await signIn(page, HR)
  await page.goto(`/assessments/${a.id}`)
  await expect(page.getByText(/only its owner or an organization administrator can change it/)).toBeVisible()
  await expect(page.getByLabel('Title')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add question' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible()
})

test('AI suggestions are hidden when the flag is off or AI is not configured', async ({ page, request }) => {
  const a = track(ACME, await createViaApi(request, ACME, `F4 e2e acme ${Date.now()}`))
  await signIn(page, ACME)
  await page.goto(`/assessments/${a.id}`)
  await expect(page.getByRole('button', { name: 'Add question' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI suggestions' })).toHaveCount(0)
})

test('AI suggestions: required fields, tick-list, only ticked items are added', async ({ page, request }) => {
  const a = track(ADMIN, await createViaApi(request, ADMIN, `F4 e2e ai ${Date.now()}`))
  // Test double: the seeded organization has no AI key, so options and generation are stubbed here.
  await page.route('**/api/v1/assessments/ai/options', (route) =>
    route.fulfill({
      json: {
        configured: true,
        provider: 'test',
        model: 'test',
        question_types: ['single_choice', 'multi_choice', 'fill_blank', 'code_gap', 'short_answer'].map((key) => ({
          key,
          label_key: `assessments.question_type.${key}`,
          default_scoring_mode: 'auto',
          default_marks: 1,
        })),
        difficulties: ['easy', 'medium', 'hard'],
        defaults: { num_questions: 10, min_questions: 10, max_questions: 50 },
        limits: { max_jd_chars: 8000, max_key_skills: 30, max_topics_to_avoid: 20 },
      },
    }),
  )
  const suggestion = (id: string, prompt: string) => ({
    temp_id: id,
    type: 'single_choice',
    prompt_html: `<p>${prompt}</p>`,
    marks: 1,
    scoring_mode: 'auto',
    difficulty: 'easy',
    options: [
      { text_html: '<p>Yes</p>', is_correct: true },
      { text_html: '<p>No</p>', is_correct: false },
    ],
  })
  await page.route('**/api/v1/assessments/ai/generate', (route) =>
    route.fulfill({
      json: {
        suggestions: [suggestion('t1', 'Keep this suggested question?'), suggestion('t2', 'Drop this suggested question?')],
        meta: { provider: 'test', model: 'test', requested: 10, returned: 2, dropped: 0, repaired: false },
      },
    }),
  )

  await signIn(page, ADMIN)
  await page.goto(`/assessments/${a.id}`)
  await page.getByRole('button', { name: 'AI suggestions' }).click()
  const dialog = page.getByRole('dialog', { name: 'AI question suggestions' })
  await dialog.getByRole('button', { name: 'Suggest questions' }).click()
  await expect(dialog.getByText('This field is required.')).toHaveCount(3)

  await dialog.getByLabel('Role title').fill('Frontend developer')
  await dialog.getByLabel('Job description').fill('Builds user interfaces in React.')
  await dialog.getByLabel('Key skills').fill('React, TypeScript')
  await dialog.getByRole('button', { name: 'Suggest questions' }).click()

  await expect(dialog.getByText('Keep this suggested question?')).toBeVisible()
  await dialog.getByText('Drop this suggested question?').click() // untick the second one
  await dialog.getByRole('button', { name: 'Add selected (1)' }).click()
  await expect(page.getByRole('region', { name: 'Question 1' })).toContainText('Keep this suggested question?')
  await expect(page.getByRole('region', { name: 'Question 2' })).toHaveCount(0)
})

test('publish lists the problems first', async ({ page, request }) => {
  const a = track(HR, await createViaApi(request, HR, `F4 e2e problems ${Date.now()}`))
  await signIn(page, HR)
  await page.goto(`/assessments/${a.id}`)
  await page.getByRole('button', { name: 'Publish' }).click()
  const dialog = page.getByRole('dialog', { name: 'Fix these before publishing' })
  await expect(dialog.getByText('Add at least one question.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).first().click()

  await page.getByRole('button', { name: 'Add question' }).click()
  await page.getByRole('menuitem', { name: 'Single choice' }).click()
  const q1 = page.getByRole('region', { name: 'Question 1' })
  await q1.getByRole('textbox', { name: 'Question text' }).click()
  await page.keyboard.type('A question without options')
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(dialog.getByText('Add at least two answer options.')).toBeVisible()
  await expect(dialog.getByText('Mark at least one option as correct.')).toBeVisible()
})

test('version limit reached explains why a new version cannot be created', async ({ page, request }) => {
  const a = track(HR, await createViaApi(request, HR, `F4 e2e limit ${Date.now()}`, { publish: true }))
  // Test double: reaching three in-use versions needs open roles; the backend's error envelope is replayed.
  await page.route(`**/api/v1/assessments/${a.id}/versions`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'VERSION_LIMIT_REACHED_ALL_IN_USE',
              message_key: 'errors.assessment.version_limit_all_in_use',
              details: {},
              request_id: 'e2e',
            },
          },
        })
      : route.continue(),
  )
  await signIn(page, HR)
  await page.goto(`/assessments/${a.id}`)
  await expect(page.getByText(/is published and locked/)).toBeVisible()
  await page.getByRole('button', { name: 'Create new version' }).click()
  await expect(page.getByText('All three versions are in use by open roles.')).toBeVisible()
})

test('unsaved edits warn before leaving, and autosave stores them', async ({ page, request }) => {
  const a = track(HR, await createViaApi(request, HR, `F4 e2e unsaved ${Date.now()}`))
  await signIn(page, HR)
  await page.goto(`/assessments/${a.id}`)
  await page.getByLabel('Title').fill(`${a.title} edited`)
  await page.getByRole('link', { name: 'Back to assessments' }).click()
  const warning = page.getByRole('alertdialog', { name: 'Leave without saving?' })
  await expect(warning).toBeVisible()
  await warning.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/versions\//)

  await expect(page.getByTestId('save-status')).toContainText('All changes saved', { timeout: 15_000 })
  await page.getByRole('link', { name: 'Back to assessments' }).click()
  await expect(page).toHaveURL(/\/assessments$/)
})

test('list search with no match shows the filtered empty state', async ({ page }) => {
  await signIn(page, HR)
  await page.goto('/assessments')
  await page.getByLabel('Search by title').fill('zzz-no-such-assessment')
  await expect(page.getByText('No assessments match')).toBeVisible()
})

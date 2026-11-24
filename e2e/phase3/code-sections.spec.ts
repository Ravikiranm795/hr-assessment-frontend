import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'

// Needs the backend on :8000 with the demo seed and RUNNER_DRIVER=local_dev (node on PATH).
// Each run creates a new coding assessment through the backend's own demo script.
const BACKEND = 'd:\\HR assessment\\hr-assessment-backend'
const ENV_SCRIPT = 'd:\\HR assessment\\_runtime\\env.ps1'

function createCodeDemoPath(): string {
  const out = execFileSync(
    'powershell',
    ['-NoProfile', '-Command', `. "${ENV_SCRIPT}"; & .\\.venv\\Scripts\\python.exe scripts\\make_code_demo.py`],
    { cwd: BACKEND, encoding: 'utf8', timeout: 90_000 },
  )
  const match = /exam url:\s*(\S+)/.exec(out)
  if (!match) throw new Error(`No exam url in the demo script output:\n${out}`)
  return new URL(match[1]).pathname
}

async function startExam(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel(/I have read the statement/).check()
  await page.getByRole('button', { name: 'I agree and continue' }).click()
  await page.getByRole('button', { name: 'Turn on the camera' }).click()
  await expect(page.locator('video')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByRole('button', { name: 'Take the photo again' })).toBeVisible()
  await page.getByRole('button', { name: 'Test fullscreen' }).click()
  await page.getByRole('button', { name: 'Start the exam' }).click()
  await expect(page.getByRole('heading', { name: 'Your sections' })).toBeVisible()
  const back = page.getByRole('button', { name: 'Return to fullscreen' })
  if (await back.isVisible().catch(() => false)) await back.click()
}

test('sectioned code exam: run samples, switch sections, submit sections and the assessment', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto(createCodeDemoPath())
  await startExam(page)

  // Overview: one card per section, nothing closed yet.
  await expect(page.getByRole('heading', { name: 'Multiple-choice questions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Coding question 1/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Coding question 2/ })).toBeVisible()
  await expect(page.getByText('Not started')).toHaveCount(3)

  // Code section: statement, samples, starter code, run.
  await page.getByRole('button', { name: /^Enter: Coding question 1/ }).click()
  await expect(page.getByRole('timer')).toHaveText(/\d\d:\d\d/)
  await expect(page.getByText('Sample 3', { exact: true })).toBeVisible()
  const editor = page.locator('.cm-content')
  await expect(editor).toContainText("require('fs')")
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(
    "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
  )
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText('3 of 3 samples passed')).toBeVisible({ timeout: 30_000 })

  // Switch to the multiple-choice section (the code clock pauses), answer one, and come back.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Multiple-choice questions' }).click()
  await expect(page.getByText(/clock of Coding question 1 is paused/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Question 1 of 3' })).toBeVisible()
  await page.getByLabel('const').check()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Coding question 1' }).click()
  await expect(page.getByText(/clock of Multiple-choice questions is paused/)).toBeVisible()
  await expect(page.locator('.cm-content')).toContainText('console.log(a + b)')

  // Submit the code section: back to the overview with that section closed.
  await page.getByRole('button', { name: 'Submit this section' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit section' }).click()
  await expect(page.getByRole('heading', { name: 'Your sections' })).toBeVisible()
  await expect(page.getByText('Submitted', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Closed: Coding question 1/ })).toBeDisabled()

  // Submit the multiple-choice section too, then finish early with the second coding question unopened.
  await page.getByRole('button', { name: /^(Resume|Enter): Multiple-choice questions/ }).click()
  await page.getByRole('button', { name: 'Submit this section' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit section' }).click()
  await expect(page.getByRole('heading', { name: 'Your sections' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit assessment now' }).click()
  await expect(page.getByRole('alertdialog').getByText(/1 section is not finished/)).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('heading', { name: /your exam has been submitted/ })).toBeVisible({ timeout: 30_000 })
})

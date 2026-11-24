import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

// Chrome's default fake camera is a moving test pattern that the face detector sometimes sees as a face, so a
// "no human" spell is not reproducible with it. A blank grey clip (written fresh into the temp folder, nothing
// committed) never contains a face, so the no_face spell always happens.
function writeBlankClip(): string {
  const w = 320
  const h = 240
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Buffer.alloc(w * h, 128), Buffer.alloc((w * h) / 2, 128)])
  const header = Buffer.from(`YUV4MPEG2 W${w} H${h} F10:1 Ip A1:1 C420jpeg\n`)
  const file = join(mkdtempSync(join(tmpdir(), 'blank-cam-')), 'blank.y4m')
  writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 20 }, () => frame)]))
  return file
}
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${writeBlankClip()}`,
    ],
  },
})

// Needs the backend on :8000 with the demo seed and RUNNER_DRIVER=local_dev (node on PATH).
// The fake camera shows no human face, so a no_face spell is reported and must carry a proof photo.
const BACKEND = 'd:\\HR assessment\\hr-assessment-backend'
const ENV_SCRIPT = 'd:\\HR assessment\\_runtime\\env.ps1'
const API = 'http://localhost:8000'

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

interface Row { id?: string; attempt_id?: string; role_id?: string }
const rows = (body: unknown): Row[] =>
  Array.isArray(body) ? body : ((body as { items?: Row[] })?.items ?? [])

test('no_face spell gets a proof photo the reviewer can open', async ({ page, request }) => {
  test.setTimeout(180_000)
  const startedAt = Date.now()
  await page.goto(createCodeDemoPath())
  await startExam(page)

  await page.getByRole('button', { name: /^Enter: Coding question 1/ }).click()
  await expect(page.getByRole('timer')).toHaveText(/\d\d:\d\d/)
  await page.waitForTimeout(30_000) // model load, a 3 s no-face spell, then the 5 s flush

  await page.getByRole('button', { name: 'Submit this section' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit section' }).click()
  await expect(page.getByRole('heading', { name: 'Your sections' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit assessment now' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('heading', { name: /your exam has been submitted/ })).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3000) // proof uploads are fire-and-forget

  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: 'hana@one.demo.example.com', password: 'DemoPass#2026' },
  })
  expect(login.ok()).toBeTruthy()
  const token = ((await login.json()) as { access_token: string }).access_token
  const headers = { Authorization: `Bearer ${token}` }

  const roles = rows(await (await request.get(`${API}/api/v1/roles`, { headers })).json())
  let found: { attempt: string; asset: string } | null = null
  for (const role of roles) {
    const list = rows(await (await request.get(`${API}/api/v1/roles/${role.id}/attempts`, { headers })).json())
    for (const a of list.slice(0, 5)) {
      const id = a.id ?? a.attempt_id
      const detail = (await (await request.get(`${API}/api/v1/attempts/${id}`, { headers })).json()) as {
        timeline?: { type: string; occurred_at: string; snapshot_asset_id: string | null }[]
      }
      const hit = detail.timeline?.find(
        (e) =>
          (e.type === 'no_face' || e.type === 'looking_away') &&
          e.snapshot_asset_id &&
          new Date(e.occurred_at).getTime() >= startedAt - 60_000,
      )
      if (hit) found = { attempt: id!, asset: hit.snapshot_asset_id! }
      if (found) break
    }
    if (found) break
  }
  expect(found, 'a no_face/looking_away event with a proof photo').not.toBeNull()
  const url = await request.get(`${API}/api/v1/attempts/${found!.attempt}/snapshots/${found!.asset}/url`, { headers })
  expect(url.ok()).toBeTruthy()
  expect(((await url.json()) as { url?: string }).url).toBeTruthy()
})

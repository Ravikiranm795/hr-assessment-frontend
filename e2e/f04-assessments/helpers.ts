import type { APIRequestContext, Page } from '@playwright/test'

export const PASSWORD = 'DemoPass#2026'

export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Main menu' }).waitFor()
}

async function authHeaders(request: APIRequestContext, email: string) {
  const res = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } })
  const body = (await res.json()) as { access_token: string }
  return { Authorization: `Bearer ${body.access_token}` }
}

export interface Created {
  id: string
  vid: string
  title: string
}

/** Creates an assessment owned by `email` through the live API (own test data only). */
export async function createViaApi(
  request: APIRequestContext,
  email: string,
  title: string,
  opts: { publish?: boolean } = {},
): Promise<Created> {
  const headers = await authHeaders(request, email)
  const created = (await (await request.post('/api/v1/assessments', { headers, data: { title } })).json()) as {
    id: string
    versions: { id: string }[]
  }
  const vid = created.versions[0].id
  if (opts.publish) {
    await request.post(`/api/v1/assessments/${created.id}/versions/${vid}/questions`, {
      headers,
      data: {
        type: 'single_choice',
        prompt_html: '<p>Which keyword declares a constant?</p>',
        marks: 1,
        options: [
          { text_html: '<p>const</p>', is_correct: true },
          { text_html: '<p>var</p>', is_correct: false },
        ],
      },
    })
    await request.post(`/api/v1/assessments/${created.id}/versions/${vid}/publish`, { headers })
  }
  return { id: created.id, vid, title }
}

export async function removeViaApi(request: APIRequestContext, email: string, id: string) {
  const headers = await authHeaders(request, email)
  await request.delete(`/api/v1/assessments/${id}`, { headers })
}

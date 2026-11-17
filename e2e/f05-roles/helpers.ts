import type { APIRequestContext, Page } from '@playwright/test'

export const PASSWORD = 'DemoPass#2026'

// Login is rate limited and the demo database is shared with other agents, so both logins wait and retry on 429.
export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  const nav = page.getByRole('navigation', { name: 'Main menu' })
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    if (await nav.waitFor({ timeout: 4000 }).then(() => true, () => false)) return
    await page.waitForTimeout(7000)
  }
  await nav.waitFor()
}

const tokens = new Map<string, string>()

export async function apiLogin(request: APIRequestContext, email: string) {
  let token = tokens.get(email)
  for (let attempt = 0; !token && attempt < 8; attempt += 1) {
    const res = await request.post('/api/v1/auth/login', { data: { email, password: PASSWORD } })
    if (res.ok()) token = ((await res.json()) as { access_token: string }).access_token
    else await new Promise((resolve) => setTimeout(resolve, 7000))
  }
  if (!token) throw new Error('login failed')
  tokens.set(email, token)
  return { headers: { Authorization: `Bearer ${token}` } }
}

type Auth = Awaited<ReturnType<typeof apiLogin>>

export function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

/** A fresh draft role owned by the signed-in user (own data; seeded roles are never touched). */
export async function createRole(request: APIRequestContext, auth: Auth, title = unique('E2E role')) {
  const res = await request.post('/api/v1/roles', { ...auth, data: { title, vacancies: 1 } })
  const role = (await res.json()) as { id: string; title: string }
  return role
}

/** Links the first linkable assessment and opens the role. */
export async function createOpenRole(request: APIRequestContext, auth: Auth) {
  const role = await createRole(request, auth)
  const list = await request.get('/api/v1/assessments?linkable=true&page_size=1', auth)
  const first = ((await list.json()) as { items: { latest_published_version_id: string }[] }).items[0]
  await request.put(`/api/v1/roles/${role.id}/assessment`, {
    ...auth,
    data: { assessment_version_id: first.latest_published_version_id },
  })
  await request.post(`/api/v1/roles/${role.id}/open`, auth)
  return role
}

export async function createInvite(request: APIRequestContext, auth: Auth, roleId: string, name: string, email: string) {
  const res = await request.post(`/api/v1/roles/${roleId}/invites`, {
    ...auth,
    data: { candidate_name: name, email },
  })
  const body = (await res.json()) as { invite: { id: string }; exam_url: string }
  return { id: body.invite.id, token: body.exam_url.split('/').pop() as string }
}

/** Candidate side: open the exam session with the invite token and ask for help. */
export async function createHelpRequest(request: APIRequestContext, token: string, note: string) {
  const opened = await request.post('/api/v1/exam/session/open', { data: { token } })
  const session = (await opened.json()) as { session_token: string }
  await request.post('/api/v1/exam/help-requests', {
    headers: { Authorization: `Bearer ${session.session_token}` },
    data: { reason: 'other', note },
  })
}

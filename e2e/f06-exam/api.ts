// Live-backend helpers for the exam specs: HR signs in, invites a fresh candidate, and gets the one-time link.
// Every test creates its own invite, so seeded data is never touched.
const API = 'http://localhost:8000/api/v1'
const HR = { email: 'hana@one.demo.example.com', password: 'DemoPass#2026' }
const ROLE_TITLE = 'Senior Java Developer'

async function call<T>(path: string, token: string | null, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

export interface TestInvite {
  inviteId: string
  /** Path part only, for `page.goto`. */
  path: string
}

export async function hrToken(): Promise<string> {
  const out = await call<{ access_token: string }>('/auth/login', null, { method: 'POST', body: HR })
  return out.access_token
}

export async function createInvite(label: string): Promise<TestInvite> {
  const token = await hrToken()
  const roles = await call<{ items: Array<{ id: string; title: string; status: string }> }>('/roles?page_size=100', token)
  const role = roles.items.find((r) => r.title === ROLE_TITLE && r.status === 'open')
  if (!role) throw new Error(`No open role "${ROLE_TITLE}" for the exam specs`)
  const unique = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const created = await call<{ invite: { id: string }; exam_url: string }>(`/roles/${role.id}/invites`, token, {
    method: 'POST',
    body: { candidate_name: `E2E ${label}`, email: `${unique}@f6.example.com`, allow_duplicate: true },
  })
  return { inviteId: created.invite.id, path: new URL(created.exam_url).pathname }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await call(`/invites/${inviteId}/revoke`, await hrToken(), { method: 'POST' })
}

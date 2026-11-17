import { ApiError, NetworkError, type ErrorDetails } from './errors'

// Access token lives in memory only (spec 8.1, F-05). Never localStorage or sessionStorage.
let accessToken: string | null = null
let onSessionLost: (() => void) | null = null

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token
  },
}

/** The auth provider registers this so a failed refresh sends the user back to login. */
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  /** FormData for uploads; sent as-is. */
  form?: FormData
  signal?: AbortSignal
  /** Override the bearer token (the candidate exam uses its own session token). */
  token?: string | null
  /** Do not try a refresh on 401 (login, refresh itself, exam calls). */
  skipRefresh?: boolean
  keepalive?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function parseError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get('X-Request-ID')
  try {
    const data = (await res.json()) as {
      error?: { code: string; message_key: string; details?: ErrorDetails; request_id?: string | null }
    }
    if (data.error) {
      return new ApiError(
        res.status,
        data.error.code,
        data.error.message_key,
        data.error.details ?? {},
        data.error.request_id ?? requestId,
      )
    }
  } catch {
    // not JSON; fall through
  }
  return new ApiError(res.status, 'INTERNAL_ERROR', 'errors.common.internal', {}, requestId)
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined
  if (opts.form) {
    body = opts.form
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: opts.signal,
      credentials: 'include',
      keepalive: opts.keepalive,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new NetworkError()
  }
}

// Single-flight refresh (spec 8.1): refresh tokens rotate on every use and reusing an old one
// revokes the session, so exactly one refresh runs at a time and every waiter shares its result.
let refreshing: Promise<string | null> | null = null

export function refreshSession(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await send('/api/v1/auth/refresh', { method: 'POST' }, null)
        if (!res.ok) return null
        const data = (await res.json()) as { access_token: string | null }
        accessToken = data.access_token
        return accessToken
      } catch {
        return null
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

/** Send with the current token; on 401 do one single-flight refresh and retry. Throws `ApiError` on failure. */
async function execute(path: string, opts: RequestOptions): Promise<Response> {
  const token = opts.token !== undefined ? opts.token : accessToken
  let res = await send(path, opts, token)

  if (res.status === 401 && !opts.skipRefresh && opts.token === undefined) {
    const fresh = await refreshSession()
    if (fresh) {
      res = await send(path, opts, fresh)
    } else {
      accessToken = null
      onSessionLost?.()
    }
  }

  if (!res.ok) throw await parseError(res)
  return res
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await execute(path, opts)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** File responses (CSV / PDF exports). The filename comes from Content-Disposition when present. */
export async function requestFile(path: string, opts: RequestOptions = {}): Promise<{ blob: Blob; filename: string | null }> {
  const res = await execute(path, opts)
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')
  return { blob: await res.blob(), filename: match ? decodeURIComponent(match[1]) : null }
}

/** Save a blob through a temporary link (the file never touches storage APIs). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts: RequestOptions = {}) => request<T>(path, { ...opts, method: 'DELETE' }),
  upload: <T>(path: string, form: FormData, opts: RequestOptions = {}) =>
    request<T>(path, { ...opts, method: 'POST', form }),
}

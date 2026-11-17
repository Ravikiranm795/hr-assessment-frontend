import i18n from '@/core/i18n'

export interface FieldError {
  field: string
  code: string
}

export interface ErrorDetails {
  fields?: FieldError[]
  flag?: string
  retry_after_sec?: number
  existing_invite_id?: string
  reason?: string
  max_rows?: number
  [key: string]: unknown
}

/** One error type for every failed call (spec 8.3 envelope). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly messageKey: string
  readonly details: ErrorDetails
  readonly requestId: string | null

  constructor(
    status: number,
    code: string,
    messageKey: string,
    details: ErrorDetails = {},
    requestId: string | null = null,
  ) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.messageKey = messageKey
    this.details = details
    this.requestId = requestId
  }

  is(...codes: string[]) {
    return codes.includes(this.code)
  }

  get fieldErrors(): FieldError[] {
    return Array.isArray(this.details.fields) ? this.details.fields : []
  }
}

/** Thrown when the server cannot be reached at all. */
export class NetworkError extends Error {
  constructor() {
    super('NETWORK')
    this.name = 'NetworkError'
  }
}

/** User-facing text for any thrown value. Uses `message_key`, never the raw code. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const seconds = error.details.retry_after_sec
    if (i18n.exists(error.messageKey)) return i18n.t(error.messageKey, { seconds })
    return i18n.t('errors.unknown')
  }
  if (error instanceof NetworkError) return i18n.t('errors.network')
  return i18n.t('errors.unknown')
}

/** Text for one `422 details.fields` entry; unknown codes read as generic "invalid". */
export function fieldErrorText(code: string): string {
  const key = `fieldErrors.${code}`
  return i18n.exists(key) ? i18n.t(key) : i18n.t('fieldErrors.invalid')
}

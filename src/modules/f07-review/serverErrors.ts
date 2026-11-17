import { ApiError, errorText, fieldErrorText } from '@/core/api/errors'

/** One readable line for a failed call inside a dialog: the first field error if any, else the error text. */
export function applyServerMessage(error: unknown): string {
  if (error instanceof ApiError && error.fieldErrors.length > 0) return fieldErrorText(error.fieldErrors[0].code)
  return errorText(error)
}

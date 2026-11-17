import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, fieldErrorText } from '@/core/api/errors'

/**
 * Map a backend `422 details.fields` list onto react-hook-form fields (spec 8.3).
 * Returns the number of errors it placed, so callers can fall back to a banner when it is 0.
 */
export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): number {
  if (!(error instanceof ApiError)) return 0
  let placed = 0
  for (const { field, code } of error.fieldErrors) {
    // Backend paths look like `body.email` or `email`; the form field is the last segment.
    const name = field.split('.').pop() as Path<T>
    setError(name, { type: 'server', message: fieldErrorText(code) })
    placed += 1
  }
  return placed
}

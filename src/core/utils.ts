import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Render an ISO 8601 UTC date in the organization's timezone (spec 8.7). */
export function formatDateTime(iso: string | null | undefined, timeZone?: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
    new Date(iso),
  )
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

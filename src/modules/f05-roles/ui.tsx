import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Badge as SharedBadge } from '@/components/Badge'
import { cn } from '@/core/utils'

// Shared pieces under the names this module already uses.
export { Modal as Dialog } from '@/components/Modal'
export { Textarea as TextAreaField } from '@/components/Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hideLabel?: boolean
}

/** Native select with a label (no shared select yet). */
export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hideLabel, className, id, children, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className={cn('block text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
      </label>
      <select
        ref={ref}
        id={inputId}
        className={cn('h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm', className)}
        {...rest}
      >
        {children}
      </select>
    </div>
  )
})

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info'
const tone: Record<string, Tone> = {
  open: 'success',
  approved: 'success',
  submitted: 'success',
  invited: 'info',
  started: 'warning',
  expired: 'warning',
  revoked: 'error',
  rejected: 'error',
}

export function Badge({ value, label }: { value: string; label: string }) {
  return <SharedBadge tone={tone[value] ?? 'neutral'}>{label}</SharedBadge>
}

export function Banner({ kind, children }: { kind: 'error' | 'warning' | 'info'; children: ReactNode }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-(--radius) border p-3 text-sm',
        kind === 'error' && 'border-error/30 bg-error/5 text-error',
        kind === 'warning' && 'border-warning/40 bg-warning/10',
        kind === 'info' && 'border-border bg-bg',
      )}
    >
      {children}
    </div>
  )
}

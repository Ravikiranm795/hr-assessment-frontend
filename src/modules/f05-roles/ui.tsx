import * as RadixDialog from '@radix-ui/react-dialog'
import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  wide?: boolean
  children: ReactNode
}

/** Module-local modal (no shared dialog yet). Radix handles focus trap, Escape and aria roles. */
export function Dialog({ open, onOpenChange, title, description, wide, children }: DialogProps) {
  const { t } = useTranslation()
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-navy/40" />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-(--radius) bg-surface p-6 shadow-card',
            wide ? 'max-w-2xl' : 'max-w-md',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close className="text-xl leading-none text-muted hover:text-text" aria-label={t('common.close')}>
              ×
            </RadixDialog.Close>
          </div>
          {description && (
            <RadixDialog.Description className="mt-2 text-sm text-muted">{description}</RadixDialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextAreaField(
  { label, error, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-(--radius) border bg-surface px-3 py-2 text-sm',
          error ? 'border-error' : 'border-border',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hideLabel?: boolean
}

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

const tone: Record<string, string> = {
  open: 'bg-success/10 text-success',
  approved: 'bg-success/10 text-success',
  submitted: 'bg-success/10 text-success',
  invited: 'bg-primary/10 text-primary',
  started: 'bg-warning/15 text-warning',
  draft: 'bg-bg text-muted',
  waiting: 'bg-bg text-muted',
  closed: 'bg-bg text-muted',
  expired: 'bg-warning/15 text-warning',
  revoked: 'bg-error/10 text-error',
  rejected: 'bg-error/10 text-error',
}

export function Badge({ value, label }: { value: string; label: string }) {
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', tone[value] ?? 'bg-bg text-muted')}>
      {label}
    </span>
  )
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

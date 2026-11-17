import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/core/utils'

interface WrapProps {
  label: string
  error?: string
  hint?: ReactNode
}

/** Labelled native select (module-local; promotion candidate). */
export const SelectField = forwardRef<HTMLSelectElement, WrapProps & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, className, id, children, ...rest }, ref) {
    const auto = useId()
    const selectId = id ?? auto
    return (
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="block text-sm font-medium">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-10 w-full rounded-(--radius) border bg-surface px-3 text-sm disabled:bg-bg',
            error ? 'border-error' : 'border-border',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        {hint && !error && <p className="text-xs text-muted">{hint}</p>}
        {error && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)

/** Labelled textarea (module-local; promotion candidate). */
export const TextareaField = forwardRef<HTMLTextAreaElement, WrapProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextareaField({ label, error, hint, className, id, ...rest }, ref) {
    const auto = useId()
    const areaId = id ?? auto
    return (
      <div className="space-y-1.5">
        <label htmlFor={areaId} className="block text-sm font-medium">
          {label}
        </label>
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-20 w-full rounded-(--radius) border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 disabled:bg-bg',
            error ? 'border-error' : 'border-border',
            className,
          )}
          {...rest}
        />
        {hint && !error && <p className="text-xs text-muted">{hint}</p>}
        {error && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)

/** Small status pill. */
export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'border-border bg-bg text-muted',
        tone === 'success' && 'border-success/40 bg-success/10 text-success',
        tone === 'warning' && 'border-warning/40 bg-warning/10 text-warning',
        tone === 'error' && 'border-error/40 bg-error/10 text-error',
      )}
    >
      {children}
    </span>
  )
}

/** Inline alert banner. */
export function Banner({
  tone = 'info',
  children,
  action,
  id,
}: {
  tone?: 'info' | 'warning' | 'error'
  children: ReactNode
  action?: ReactNode
  id?: string
}) {
  return (
    <div
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border p-3 text-sm',
        tone === 'info' && 'border-border bg-surface',
        tone === 'warning' && 'border-warning/40 bg-warning/10',
        tone === 'error' && 'border-error/30 bg-error/5 text-error',
      )}
    >
      <div>{children}</div>
      {action}
    </div>
  )
}

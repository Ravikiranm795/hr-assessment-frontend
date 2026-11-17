import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/core/utils'

interface WrapProps {
  label: string
  error?: string
  hint?: ReactNode
}

/** Labelled native select (module-local; promotion candidate: no shared select exists yet). */
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

/** Inline alert banner (module-local; promotion candidate). */
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

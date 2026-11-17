import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/core/utils'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: ReactNode
}

/** Labelled input with an announced error (spec 8.10). Works with react-hook-form's `register`. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  const errorId = `${inputId}-error`
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-(--radius) border bg-surface px-3 text-sm placeholder:text-muted/70',
          error ? 'border-error' : 'border-border',
          className,
        )}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
})

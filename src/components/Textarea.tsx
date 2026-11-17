import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/core/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

/** Labelled textarea with an announced error; same contract as Field. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, className, id, ...rest }, ref) {
  const auto = useId()
  const key = id ?? auto
  return (
    <div className="space-y-1.5">
      <label htmlFor={key} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={key}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn('w-full rounded-(--radius) border bg-surface px-3 py-2 text-sm', error ? 'border-error' : 'border-border', className)}
        {...rest}
      />
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
})

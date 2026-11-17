import { cn } from '@/core/utils'

interface SpinnerProps {
  label: string
  fullPage?: boolean
  className?: string
}

export function Spinner({ label, fullPage, className }: SpinnerProps) {
  return (
    <div
      role="status"
      className={cn('flex items-center justify-center gap-3 text-muted', fullPage && 'min-h-screen', className)}
    >
      <span className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

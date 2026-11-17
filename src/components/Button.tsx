import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/core/utils'

// eslint-disable-next-line react-refresh/only-export-components
export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-(--radius) font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-contrast hover:brightness-95',
        accent: 'bg-accent text-accent-contrast hover:brightness-95',
        outline: 'border border-border bg-surface text-text hover:bg-bg',
        ghost: 'text-text hover:bg-bg',
        danger: 'bg-error text-white hover:brightness-95',
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  loading?: boolean
}

export function Button({ variant, size, loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

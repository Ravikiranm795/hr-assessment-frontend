import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** `lg` for the preview and AI dialogs. */
  size?: 'md' | 'lg' | 'xl'
  /** Block close by overlay click or Escape (long-running work). */
  locked?: boolean
}

/** Module-local modal (promotion candidate for src/components). Focus is trapped by Radix. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', locked }: DialogProps) {
  const { t } = useTranslation()
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => (locked && !next ? undefined : onOpenChange(next))}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-navy/40" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-(--radius) bg-surface shadow-card',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-3xl',
            size === 'xl' && 'max-w-5xl',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            {!locked && (
              <RadixDialog.Close
                className="rounded-(--radius) px-2 text-xl leading-none text-muted hover:text-text"
                aria-label={t('common.close')}
              >
                ×
              </RadixDialog.Close>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-3">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

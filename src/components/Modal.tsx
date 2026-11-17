import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}

/** Form / detail dialog. For yes-no confirmations use ConfirmDialog. */
export function Modal({ open, onOpenChange, title, description, children, wide }: ModalProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy/40" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-(--radius) bg-surface p-6 shadow-card',
            wide ? 'max-w-3xl' : 'max-w-md',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-text" aria-label={t('common.close')}>
              ×
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

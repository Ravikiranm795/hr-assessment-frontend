import * as AlertDialog from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { buttonStyles } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
}

/** Confirm step for irreversible actions (decisions, close role, erase data). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-navy/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-(--radius) bg-surface p-6 shadow-card">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          {body && <AlertDialog.Description className="mt-2 text-sm text-muted">{body}</AlertDialog.Description>}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonStyles({ variant: 'outline' })}>{t('common.cancel')}</AlertDialog.Cancel>
            <AlertDialog.Action
              className={buttonStyles({ variant: danger ? 'danger' : 'primary' })}
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                onConfirm()
              }}
            >
              {confirmLabel ?? t('common.confirm')}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import type { TempPassword } from './types'

/** One-time temporary password (spec F10): shown once, with a copy button. Closing it discards the value. */
export function TempPasswordDialog({ value, onClose }: { value: TempPassword | null; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  return (
    <Modal open={value !== null} onOpenChange={(open) => !open && onClose()} title={t('team.tempPassword.title')} description={value ? t('team.tempPassword.body', { name: value.name }) : undefined}>
      {value && (
        <div className="space-y-4">
          <p className="rounded-(--radius) bg-bg p-4 text-center font-mono text-lg tracking-wide select-all">{value.password}</p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(value.password).then(() => toast.success(t('team.tempPassword.copied')))
              }}
            >
              {t('team.tempPassword.copy')}
            </Button>
            <Button onClick={onClose}>{t('team.tempPassword.done')}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

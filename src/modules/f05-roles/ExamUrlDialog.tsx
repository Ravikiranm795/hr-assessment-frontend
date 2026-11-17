import { Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Banner, Dialog } from './ui'

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={() => void copy()}>
      <Copy className="size-4" aria-hidden />
      {copied ? t('roles.url.copied') : (label ?? t('roles.url.copy'))}
    </Button>
  )
}

interface Props {
  url: string | null
  emailSent?: boolean
  onClose: () => void
}

/** The exam URL is shown exactly once: the backend keeps only a hash (spec F-12). */
export function ExamUrlDialog({ url, emailSent, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={url !== null} onOpenChange={(open) => !open && onClose()} title={t('roles.url.title')} description={t('roles.url.once')}>
      <div className="space-y-4">
        {emailSent && <Banner kind="info">{t('roles.url.emailSent')}</Banner>}
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url ?? ''}
            aria-label={t('roles.url.field')}
            className="h-10 min-w-0 flex-1 rounded-(--radius) border border-border bg-bg px-3 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          {url && <CopyButton value={url} />}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('roles.url.done')}</Button>
        </div>
      </div>
    </Dialog>
  )
}

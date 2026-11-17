import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { assessmentsApi, keys, latestVersion } from '../api'
import { Dialog } from '../ui/Dialog'
import { CandidatePreview } from './CandidatePreview'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  assessmentId: string | null
  /** When null the latest version of the assessment is shown (used from the list). */
  versionId: string | null
}

/** Popup with exactly what a candidate will see (spec F4: header, footer, watermark). */
export function PreviewDialog({ open, onOpenChange, assessmentId, versionId }: Props) {
  const { t } = useTranslation()
  const enabled = open && assessmentId !== null

  const detail = useQuery({
    queryKey: keys.detail(assessmentId ?? ''),
    queryFn: () => assessmentsApi.detail(assessmentId!),
    enabled: enabled && versionId === null,
  })
  const resolvedVersion = versionId ?? (detail.data ? latestVersion(detail.data.versions)?.id : undefined)

  const preview = useQuery({
    queryKey: keys.preview(assessmentId ?? '', resolvedVersion ?? ''),
    queryFn: () => assessmentsApi.preview(assessmentId!, resolvedVersion!),
    enabled: enabled && !!resolvedVersion,
    gcTime: 0,
  })

  const error = detail.error ?? preview.error
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('assessments.preview.title')}
      description={t('assessments.preview.body')}
      size="xl"
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>}
    >
      {error ? (
        <ErrorState error={error} onRetry={() => void (detail.error ? detail.refetch() : preview.refetch())} />
      ) : preview.data ? (
        <CandidatePreview preview={preview.data} />
      ) : (
        <Spinner label={t('common.loading')} className="py-10" />
      )}
    </Dialog>
  )
}

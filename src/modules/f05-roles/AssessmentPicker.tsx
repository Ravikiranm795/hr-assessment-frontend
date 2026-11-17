import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { roleKeys, useLinkableAssessments } from './api'
import { Banner, Dialog } from './ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleId: string
  /** The version currently linked, so the list can mark it. */
  linkedVersionId: string | null
}

/** Searchable list of assessments that have a published version (backend `linkable`). One link is active at a time. */
export function AssessmentPicker({ open, onOpenChange, roleId, linkedVersionId }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const list = useLinkableAssessments(q)

  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim()), 300)
    return () => window.clearTimeout(id)
  }, [text])

  const link = useMutation({
    mutationFn: (versionId: string) => api.put(`/api/v1/roles/${roleId}/assessment`, { assessment_version_id: versionId }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: roleKeys.all })
      onOpenChange(false)
    },
    onError: (error) => setBanner(errorText(error)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setBanner(null)
        onOpenChange(next)
      }}
      wide
      title={t('roles.assessment.pickTitle')}
      description={t('roles.assessment.pickBody')}
    >
      <div className="space-y-4">
        {banner && <Banner kind="error">{banner}</Banner>}
        <div className="space-y-1.5">
          <label htmlFor="assessment-search" className="block text-sm font-medium">
            {t('roles.assessment.search')}
          </label>
          <input
            id="assessment-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
          />
        </div>
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data ? (
          <Spinner label={t('common.loading')} className="py-6" />
        ) : list.data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t('roles.assessment.none')}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-(--radius) border border-border">
            {list.data.items.map((a) => {
              const versionId = a.latest_published_version_id
              const isCurrent = versionId !== null && versionId === linkedVersionId
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title}</p>
                    {a.description && <p className="truncate text-xs text-muted">{a.description}</p>}
                  </div>
                  {isCurrent ? (
                    <span className="text-xs text-muted">{t('roles.assessment.current')}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!versionId}
                      loading={link.isPending && link.variables === versionId}
                      aria-label={t('roles.assessment.selectFor', { title: a.title })}
                      onClick={() => versionId && link.mutate(versionId)}
                    >
                      {t('roles.assessment.select')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Dialog>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { StatePage } from '@/components/StatePage'
import { ApiError } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { assessmentsApi, canEditAssessment, keys, latestVersion } from './api'
import { BuilderEditor } from './builder/BuilderEditor'

function useFailure(error: unknown) {
  const { t } = useTranslation()
  if (!error) return null
  const notFound = error instanceof ApiError && error.status === 404
  return (
    <StatePage
      title={notFound ? t('notFound.title') : t('assessments.builder.loadFailed')}
      body={notFound ? t('notFound.body') : undefined}
      requestId={error instanceof ApiError ? error.requestId : null}
    />
  )
}

/**
 * `/assessments/:id` and `/assessments/:id/versions/:vid`. Without a version id it opens the draft
 * (or the latest version). Only the owner or an organization admin may edit.
 */
export function BuilderPage() {
  const { t } = useTranslation()
  const { id = '', vid } = useParams()
  const { me, role } = useAuth()

  const detail = useQuery({ queryKey: keys.detail(id), queryFn: () => assessmentsApi.detail(id) })
  // The editor keeps its own copy of the version, so this must not refetch under it; a fresh fetch on every mount.
  const version = useQuery({
    queryKey: keys.version(id, vid ?? ''),
    queryFn: () => assessmentsApi.version(id, vid as string),
    enabled: !!vid,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const failure = useFailure(detail.error ?? version.error)
  if (failure) return failure
  if (!detail.data) return <Spinner fullPage label={t('common.loading')} />

  if (!vid) {
    const target = detail.data.versions.find((v) => v.status === 'draft') ?? latestVersion(detail.data.versions)
    if (!target) return <StatePage title={t('notFound.title')} body={t('notFound.body')} />
    return <Navigate to={`/assessments/${id}/versions/${target.id}`} replace />
  }
  if (!version.data) return <Spinner fullPage label={t('common.loading')} />

  const canEdit = canEditAssessment(role, me?.user.id, detail.data.owner_id)
  return <BuilderEditor key={`${version.data.id}:${version.data.status}`} assessment={detail.data} version={version.data} canEdit={canEdit} />
}

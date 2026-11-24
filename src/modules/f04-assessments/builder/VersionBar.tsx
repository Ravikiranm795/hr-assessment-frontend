import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import type { AssessmentDetail, VersionOut } from '../api'
import { Banner } from '../ui/controls'

export const MAX_VERSIONS = 3

interface VersionBarProps {
  assessment: AssessmentDetail
  version: VersionOut
  canEdit: boolean
  creating: boolean
  /** Server error from "Create new version" (`DRAFT_ALREADY_EXISTS`, `VERSION_LIMIT_REACHED_ALL_IN_USE`, ...). */
  problem: { code: string; text: string } | null
  onCreate: () => void
}

/** Version bar: current version, links to the others, lock notice and Create new version (spec F4). */
export function VersionBar({ assessment, version, canEdit, creating, problem, onCreate }: VersionBarProps) {
  const { t } = useTranslation()
  const versions = [...assessment.versions].sort((a, b) => a.version_no - b.version_no)
  const draft = versions.find((v) => v.status === 'draft')
  const published = version.status === 'published'
  const canCreate = canEdit && !assessment.has_draft

  return (
    <section aria-label={t('assessments.version.label')} className="space-y-3 rounded-(--radius) border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold" data-testid="current-version">
          {t('assessments.version.current', { n: version.version_no, count: versions.length, max: MAX_VERSIONS })}
        </h2>
        <Badge tone={published ? 'success' : 'warning'}>{t(published ? 'assessments.status.published' : 'assessments.status.draft')}</Badge>
        {versions.find((v) => v.id === version.id)?.has_code && (
          <Badge tone="info">
            {t('assessments.code.includesCoding', { count: versions.find((v) => v.id === version.id)?.code_question_count ?? 0 })}
          </Badge>
        )}
        <nav aria-label={t('assessments.version.switch')} className="flex flex-wrap gap-2">
          {versions.map((v) =>
            v.id === version.id ? (
              <span key={v.id} aria-current="page" className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-contrast">
                {t('assessments.version.short', { n: v.version_no })}
              </span>
            ) : (
              <Link key={v.id} to={`/assessments/${assessment.id}/versions/${v.id}`} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-bg">
                {t('assessments.version.short', { n: v.version_no })}
              </Link>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {draft && draft.id !== version.id && (
            <Link to={`/assessments/${assessment.id}/versions/${draft.id}`} className="text-sm font-medium text-primary hover:underline">
              {t('assessments.version.goToDraft', { n: draft.version_no })}
            </Link>
          )}
          {canCreate && (
            <Button size="sm" onClick={onCreate} loading={creating}>
              {t('assessments.version.create')}
            </Button>
          )}
        </div>
      </div>

      {published && (
        <Banner tone="info">
          {t(canEdit ? 'assessments.version.lockedEditable' : 'assessments.version.locked', { n: version.version_no })}
        </Banner>
      )}
      {problem && (
        <Banner
          tone="error"
          action={
            problem.code === 'DRAFT_ALREADY_EXISTS' && draft ? (
              <Link to={`/assessments/${assessment.id}/versions/${draft.id}`} className="font-medium underline">
                {t('assessments.version.goToDraft', { n: draft.version_no })}
              </Link>
            ) : undefined
          }
        >
          {problem.text}
        </Banner>
      )}
    </section>
  )
}

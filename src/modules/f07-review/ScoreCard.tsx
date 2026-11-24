import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/core/utils'
import type { Attempt } from './types'
import { Badge } from '@/components/Badge'

/** Minutes between start and submit, or null if either is missing. */
function minutesTaken(a: Attempt) {
  if (!a.started_at || !a.submitted_at) return null
  return Math.max(1, Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60_000))
}

export function ScoreCard({ attempt }: { attempt: Attempt }) {
  const { t } = useTranslation()
  const taken = minutesTaken(attempt)
  const scored = attempt.score_percent !== null && attempt.score_percent !== undefined
  // A code-only assessment has no scored marks: the API sends null for score_percent and passed.
  const codeOnly = !scored && (attempt.code_sections?.length ?? 0) > 0 && attempt.total_marks === 0
  return (
    <section className="rounded-(--radius) border border-border bg-surface p-5 shadow-card" aria-labelledby="score-title">
      <h2 id="score-title" className="text-sm font-semibold text-muted">
        {t('review.score.title')}
      </h2>
      {scored ? (
        <div className="mt-3 flex items-end gap-4">
          <p className="text-4xl font-semibold">{t('review.score.percent', { value: formatNumber(Math.round(attempt.score_percent ?? 0)) })}</p>
          {attempt.passed !== null && attempt.passed !== undefined && <Badge tone={attempt.passed ? 'success' : 'error'}>{attempt.passed ? t('review.score.pass') : t('review.score.fail')}</Badge>}
        </div>
      ) : codeOnly ? (
        <div className="mt-3 space-y-1" data-testid="no-scored-questions">
          <p className="text-sm font-medium">{t('review.score.noScored')}</p>
          <p className="text-sm text-muted">{t('review.score.noScoredBody')}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{t('review.score.notScored')}</p>
      )}
      <dl className="mt-3 space-y-1 text-sm text-muted">
        {!codeOnly && <div>{t('review.score.passMark', { value: formatNumber(attempt.pass_mark_percent) })}</div>}
        {attempt.final_score !== null && attempt.final_score !== undefined && !codeOnly && <div>{t('review.score.marks', { got: formatNumber(attempt.final_score), total: formatNumber(attempt.total_marks) })}</div>}
        {taken !== null && (
          <div>
            {t('review.score.timeTaken')}: {t('review.score.minutes', { count: taken })}
          </div>
        )}
      </dl>
      {attempt.scoring_status === 'pending' && (
        <p role="status" className="mt-3 rounded-(--radius) bg-warning/10 p-3 text-sm text-warning">
          <strong>{t('review.score.pending')}.</strong> {t('review.score.pendingBody')}
        </p>
      )}
      {attempt.scoring_status === 'needs_manual' && (
        <p role="status" className="mt-3 rounded-(--radius) bg-warning/10 p-3 text-sm text-warning">
          <strong>{t('review.score.needsManual')}.</strong> {t('review.score.needsManualBody')}
        </p>
      )}
    </section>
  )
}

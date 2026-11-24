import * as Tabs from '@radix-ui/react-tabs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { StatePage } from '@/components/StatePage'
import { api } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import { AiSummaryTab } from './AiSummaryTab'
import { AnswersTab } from './AnswersTab'
import { AttemptActions } from './AttemptActions'
import { CodeTab } from './CodeTab'
import { DecisionPanel } from './DecisionPanel'
import { HistoryTab } from './HistoryTab'
import { ScoreCard } from './ScoreCard'
import type { Attempt } from './types'
import { Badge } from '@/components/Badge'
import { PhotosTab } from './PhotosTab'
import { ViolationsTab } from './ViolationsTab'

const TAB = 'rounded-t-(--radius) border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted data-[state=active]:border-primary data-[state=active]:text-text'

export function ReviewPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const key = ['attempt', id]

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<Attempt>(`/api/v1/attempts/${id}`),
    // AI scoring runs in a background job about every 5 minutes (spec F7): keep checking while it is pending.
    refetchInterval: (q) => (q.state.data?.scoring_status === 'pending' ? 30_000 : false),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
  const refresh = () => void client.invalidateQueries({ queryKey: key })

  if (query.isPending) return <Spinner label={t('common.loading')} className="py-20" />
  // Cross-organization or not-yours attempts answer 404 / 403: show a normal not-found page (spec 8.2).
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) {
    return <StatePage title={t('notFound.title')} body={t('notFound.body')} />
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />

  const a = query.data
  const hasCode = (a.code_sections?.length ?? 0) > 0
  const helpApproved =a.help_requests.some((h) => h.status === 'approved')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← {t('review.back')}
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{a.candidate.erased ? t('review.erased') : a.candidate.name}</h1>
            {!a.candidate.erased && a.candidate.email && <p className="text-sm text-muted">{a.candidate.email}</p>}
          </div>
          <AttemptActions attempt={a} onChanged={refresh} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{t(`review.status.${a.status}`, { defaultValue: a.status })}</Badge>
          {a.badges.camera_exempt && <Badge>{t('review.badge.cameraExempt')}</Badge>}
          {a.badges.extra_time && <Badge>{t('review.badge.extraTime')}</Badge>}
          {a.badges.auto_submitted_by_timer && <Badge tone="warning">{t('review.badge.autoSubmitted')}</Badge>}
          {helpApproved && <Badge>{t('review.badge.helpApproved')}</Badge>}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard attempt={a} />
        <DecisionPanel attempt={a} onChanged={refresh} />
      </div>

      <Tabs.Root defaultValue="answers">
        <Tabs.List className="flex gap-1 border-b border-border" aria-label={t('review.title')}>
          <Tabs.Trigger value="answers" className={TAB}>{t('review.tabs.answers')}</Tabs.Trigger>
          {hasCode && <Tabs.Trigger value="code" className={TAB}>{t('review.tabs.code')}</Tabs.Trigger>}
          <Tabs.Trigger value="violations" className={TAB}>{t('review.tabs.violations')}</Tabs.Trigger>
          <Tabs.Trigger value="photos" className={TAB}>{t('review.tabs.photos')}</Tabs.Trigger>
          <Tabs.Trigger value="ai" className={TAB}>{t('review.tabs.aiSummary')}</Tabs.Trigger>
          <Tabs.Trigger value="history" className={TAB}>{t('review.tabs.history')}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="answers" className="pt-4"><AnswersTab attempt={a} onChanged={refresh} /></Tabs.Content>
        {hasCode && <Tabs.Content value="code" className="pt-4"><CodeTab attempt={a} onChanged={refresh} /></Tabs.Content>}
        <Tabs.Content value="violations" className="pt-4"><ViolationsTab attempt={a} onChanged={refresh} /></Tabs.Content>
        <Tabs.Content value="photos" className="pt-4"><PhotosTab attempt={a} onChanged={refresh} /></Tabs.Content>
        <Tabs.Content value="ai" className="pt-4"><AiSummaryTab attempt={a} /></Tabs.Content>
        <Tabs.Content value="history" className="pt-4"><HistoryTab attempt={a} /></Tabs.Content>
      </Tabs.Root>

      <p className="text-xs text-muted">{t('review.accessNote')}</p>
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { aiSummaryKey, generateAiSummary, getAiSummary, type AiSeverity, type AiSummary } from './aiSummaryApi'
import type { Attempt } from './types'
import { RiskBadges, TONE } from './ViolationsTab'

const SEV_ORDER: Record<AiSeverity, number> = { serious: 0, moderate: 1, minor: 2, info: 3 }
const ROW_TINT: Record<AiSeverity, string> = {
  serious: 'border-l-4 border-l-error bg-error/5',
  moderate: 'border-l-4 border-l-warning bg-warning/5',
  minor: 'border-l-4 border-l-info bg-info/5',
  info: 'border-l-4 border-l-border',
}
const CARD = 'space-y-3 rounded-(--radius) border border-border bg-surface p-4 shadow-card'

export function AiSummaryTab({ attempt }: { attempt: Attempt }) {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const client = useQueryClient()
  const key = aiSummaryKey(attempt.id)

  const query = useQuery({
    queryKey: key,
    queryFn: () => getAiSummary(attempt.id),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
  const generate = useMutation({
    mutationFn: (force: boolean) => generateAiSummary(attempt.id, force),
    onSuccess: (data) => client.setQueryData(key, data),
  })

  const friendly = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === 'RATE_LIMITED' || error.status === 429) return t('review.aiSummary.errors.rateLimited', { seconds: error.details.retry_after_sec ?? 30 })
      if (error.code === 'AI_NOT_CONFIGURED') return t('review.aiSummary.errors.notConfigured')
      if (error.code === 'AI_LIMIT_REACHED') return t('review.aiSummary.errors.limitReached')
      if (error.code === 'AI_PROVIDER_ERROR' || error.code === 'AI_OUTPUT_INVALID' || [502, 503, 504].includes(error.status)) return t('review.aiSummary.errors.unavailable')
      if (error.details.reason === 'attempt_not_submitted') return t('review.aiSummary.errors.notSubmitted')
      if (error.details.reason === 'candidate_data_erased') return t('review.aiSummary.errors.erased')
    }
    return errorText(error)
  }

  const typeText = (type: string) => (i18n.exists(`review.violations.type.${type}`) ? t(`review.violations.type.${type}`) : t('review.violations.type.unknown'))
  const data: AiSummary | undefined = query.data
  const s = data?.summary ?? null

  const notice = (
    <div role="note" className="space-y-1 rounded-(--radius) border border-info/40 bg-info/10 p-3 text-sm">
      <p className="font-medium">{t('review.aiSummary.notice.title')}</p>
      <p>{t('review.aiSummary.notice.static')}</p>
      {s?.disclaimer && <p className="text-muted">{s.disclaimer}</p>}
    </div>
  )

  const generateButton = (force: boolean, label: string, variant: 'primary' | 'outline' = 'outline') => (
    <Button size="sm" variant={variant} loading={generate.isPending} disabled={generate.isPending} onClick={() => generate.mutate(force)}>
      {label}
    </Button>
  )

  const errorBox = (message: string, retry?: () => void) => (
    <div className="space-y-2 text-sm">
      <p role="alert" className="text-error">{message}</p>
      {retry && <Button size="sm" variant="outline" onClick={retry}>{t('review.aiSummary.retry')}</Button>}
    </div>
  )

  let body: ReactNode
  if (query.isPending) {
    body = (
      <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-(--radius) bg-border/50" />
        ))}
      </div>
    )
  } else if (query.isError) {
    body = errorBox(friendly(query.error), () => void query.refetch())
  } else if (!s) {
    body = (
      <div className="space-y-3 rounded-(--radius) border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">{t('review.aiSummary.empty')}</p>
        <div className="flex justify-center">{generateButton(false, t('review.aiSummary.generate'), 'primary')}</div>
        {generate.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner label={t('review.aiSummary.generating')} />
            <span>{t('review.aiSummary.generating')}</span>
          </div>
        )}
        {generate.isError && errorBox(friendly(generate.error))}
      </div>
    )
  } else {
    const highlights = [...s.integrity.highlights].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
    body = (
      <div className="space-y-4">
        {data?.stale && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius) border border-warning/50 bg-warning/10 p-3 text-sm">
            <span>{t('review.aiSummary.stale')}</span>
            {generateButton(true, t('review.aiSummary.regenerate'))}
          </div>
        )}
        <h2 className="text-lg font-semibold">{s.headline}</h2>

        <section className={CARD}>
          <h3 className="font-medium">{t('review.aiSummary.performance.title')}</h3>
          <p className="text-sm">{s.performance.overview}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <BulletList title={t('review.aiSummary.performance.strengths')} items={s.performance.strengths} empty={t('review.aiSummary.none')} />
            <BulletList title={t('review.aiSummary.performance.weakAreas')} items={s.performance.weak_areas} empty={t('review.aiSummary.none')} />
          </div>
        </section>

        {s.answers.length > 0 && (
          <section className={CARD}>
            <h3 className="font-medium">{t('review.aiSummary.answers.title')}</h3>
            <ul className="space-y-2 text-sm">
              {s.answers.map((a) => (
                <li key={a.question_id} className="flex gap-3">
                  <Badge>{t('review.aiSummary.answers.question', { position: a.position })}</Badge>
                  <span>{a.note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{t('review.aiSummary.integrity.title')}</h3>
            {attempt.risk && <RiskBadges risk={attempt.risk} />}
          </div>
          <p className="text-sm">{s.integrity.overview}</p>
          {highlights.length === 0 ? (
            <p className="text-sm text-muted">{t('review.aiSummary.integrity.none')}</p>
          ) : (
            <ul className="space-y-2">
              {highlights.map((h, i) => (
                <li key={`${h.type}-${i}`} className={`space-y-1 rounded-(--radius) px-3 py-2 text-sm ${ROW_TINT[h.severity] ?? ROW_TINT.info}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[h.severity] ?? 'neutral'}>{t(`review.violations.severity.${h.severity}`, { defaultValue: h.severity })}</Badge>
                    <span className="font-medium">{typeText(h.type)}</span>
                    <span className="text-muted">{t('review.aiSummary.integrity.count', { count: h.count })}</span>
                  </div>
                  <p>{h.note}</p>
                </li>
              ))}
            </ul>
          )}
          {s.integrity.caveat && (
            <p className="rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-xs text-muted">{s.integrity.caveat}</p>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {t('review.aiSummary.generated', { time: formatDateTime(data?.generated_at ?? null, tz), model: data?.model ?? '-' })}
          </span>
          {generateButton(true, t('review.aiSummary.regenerate'))}
        </footer>
        {generate.isPending && <p className="text-xs text-muted">{t('review.aiSummary.generating')}</p>}
        {generate.isError && errorBox(friendly(generate.error))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notice}
      {body}
    </div>
  )
}

function BulletList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

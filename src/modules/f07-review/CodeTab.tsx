import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '@/api-types/schema'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { CodeEditor } from '@/components/code-editor/CodeEditor'
import { CODE_LANGUAGES, isCodeLanguage } from '@/components/code-editor/languages'
import { Html } from '@/components/Html'
import { Textarea } from '@/components/Textarea'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime, formatNumber } from '@/core/utils'
import type { Attempt } from './types'

type S = components['schemas']
type CodeSection = S['CodeAnswerReport']
type AiReview = S['CodeAiReviewOut']
type Verdict = S['CodeVerdictOut']

const NOTE_MAX = 1000

const asText = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

function minutesSeconds(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Coding questions of an attempt: code, practice-run evidence, AI review and human verdict (both advisory). */
export function CodeTab({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const { t } = useTranslation()
  const sections = [...(attempt.code_sections ?? [])].sort((a, b) => a.position - b.position)
  return (
    <div className="space-y-6" data-testid="code-tab">
      <p className="rounded-(--radius) border border-border bg-bg p-3 text-sm text-muted">{t('review.code.intro')}</p>
      {sections.map((s, i) => (
        <CodeSectionCard key={s.question_id} section={s} index={i} attemptId={attempt.id} onChanged={onChanged} />
      ))}
    </div>
  )
}

function CodeSectionCard({ section: s, index, attemptId, onChanged }: { section: CodeSection; index: number; attemptId: string; onChanged: () => void }) {
  const { t } = useTranslation()
  const language = isCodeLanguage(s.language) ? s.language : 'python'
  const languageLabel = CODE_LANGUAGES.find((l) => l.id === s.language)?.label ?? s.language ?? t('review.code.unknownLanguage')
  return (
    <section className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card" aria-label={t('review.code.questionN', { n: index + 1 })}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold">{t('review.code.questionN', { n: index + 1 })}</h3>
        <Badge tone="info">{languageLabel}</Badge>
        {s.state && <Badge>{t(`review.code.state.${s.state}`, { defaultValue: s.state })}</Badge>}
      </div>

      <Html html={s.prompt_html} />

      <p className="text-sm text-muted" data-testid="code-time">
        {t('review.code.time', { spent: minutesSeconds(s.spent_seconds), allowed: minutesSeconds(s.duration_seconds) })}
        {' · '}
        {t('review.code.switches', { count: s.switch_count })}
      </p>

      {s.code === null || s.code === '' ? (
        <p className="rounded-(--radius) border border-dashed border-border p-4 text-sm text-muted">{t('review.code.noCode')}</p>
      ) : (
        <CodeEditor value={s.code} language={language} label={t('review.code.codeLabel', { n: index + 1 })} readOnly height="20rem" />
      )}

      <RunEvidence section={s} />

      <div className="grid gap-4 md:grid-cols-2">
        <AiReviewCard section={s} attemptId={attemptId} onChanged={onChanged} />
        <VerdictCard key={s.human_verdict?.at ?? 'none'} section={s} attemptId={attemptId} onChanged={onChanged} />
      </div>
    </section>
  )
}

function RunEvidence({ section: s }: { section: CodeSection }) {
  const { t } = useTranslation()
  const latest = s.runs.latest
  return (
    <div className="space-y-2 rounded-(--radius) border border-border p-3" data-testid="code-runs">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{t('review.code.runs.title')}</h4>
        <span className="text-xs text-muted">{t('review.code.runs.count', { count: s.runs.count })}</span>
      </div>
      <p className="text-xs text-muted">{t('review.code.runs.notGrade')}</p>
      {!latest ? (
        <p className="text-sm text-muted">{t('review.code.runs.none')}</p>
      ) : (
        <>
          <p className="text-sm font-medium">{t('review.code.runs.latest', { passed: latest.passed, total: latest.total })}</p>
          <ul className="space-y-2">
            {latest.results.map((r, i) => {
              const status = asText(r.status)
              const ok = status === 'passed'
              return (
                <li key={i} className="space-y-1 rounded-(--radius) border border-border bg-bg p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('review.code.runs.sample', { n: i + 1 })}</span>
                    <Badge tone={ok ? 'success' : 'error'}>{t(`review.code.runs.status.${status}`, { defaultValue: status })}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <RunBox label={t('review.code.runs.input')} value={asText(r.input)} />
                    <RunBox label={t('review.code.runs.expected')} value={asText(r.expected)} />
                    <RunBox label={t('review.code.runs.actual')} value={asText(r.actual) || asText(r.stderr)} />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function RunBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-muted">{label}</p>
      <pre className="max-h-32 overflow-auto font-mono whitespace-pre-wrap">{value}</pre>
    </div>
  )
}

function AiReviewCard({ section: s, attemptId, onChanged }: { section: CodeSection; attemptId: string; onChanged: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const review: AiReview = s.ai_review
  const [error, setError] = useState<string | null>(null)

  const run = useMutation({
    mutationFn: () => api.post<AiReview>(`/api/v1/attempts/${attemptId}/answers/${s.question_id}/ai-review`),
    onSuccess: () => {
      setError(null)
      toast.success(t('review.code.ai.rerun.done'))
      onChanged()
    },
    onError: (e) => {
      setError(t('review.code.ai.rerun.failed'))
      toast.error(e)
    },
  })

  return (
    <div className="space-y-3 rounded-(--radius) border border-border p-4" data-testid="code-ai-review">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{t('review.code.ai.title')}</h4>
        <p className="text-xs text-muted">{t('review.code.advisory')}</p>
      </div>

      {review.status === 'done' ? (
        <div className="space-y-3">
          <p>
            <span className="text-3xl font-semibold">{t('review.score.percent', { value: formatNumber(Math.round(review.percent ?? 0)) })}</span>{' '}
            <span className="text-xs text-muted">{t('review.code.ai.percentLabel')}</span>
          </p>
          {review.summary && <p className="text-sm">{review.summary}</p>}
          <ReviewList title={t('review.code.ai.strengths')} items={review.strengths ?? []} tone="text-success" />
          <ReviewList title={t('review.code.ai.issues')} items={review.issues ?? []} tone="text-error" />
          {review.reviewed_at && <p className="text-xs text-muted">{t('review.code.ai.reviewedAt', { when: formatDateTime(review.reviewed_at, tz) })}</p>}
        </div>
      ) : review.status === 'pending' ? (
        <p role="status" className="text-sm text-muted">{t('review.code.ai.pending')}</p>
      ) : (
        <p role="status" className="text-sm text-muted">
          {t('review.code.ai.unavailable')} {review.reason && <span>{t(`review.code.ai.reason.${review.reason}`, { defaultValue: review.reason })}</span>}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      <Button variant="outline" size="sm" loading={run.isPending} onClick={() => run.mutate()}>
        {t(review.status === 'done' ? 'review.code.ai.rerun.again' : 'review.code.ai.rerun.run')}
      </Button>
    </div>
  )
}

function ReviewList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className={`text-xs font-semibold ${tone}`}>{title}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

function VerdictCard({ section: s, attemptId, onChanged }: { section: CodeSection; attemptId: string; onChanged: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const current: Verdict | null = s.human_verdict ?? null
  const [verdict, setVerdict] = useState<Verdict['verdict'] | null>(current?.verdict ?? null)
  const [note, setNote] = useState(current?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      api.put<Verdict>(`/api/v1/attempts/${attemptId}/answers/${s.question_id}/verdict`, { verdict, note: note.trim() || null }),
    onSuccess: () => {
      setError(null)
      toast.success(t('review.code.verdict.saved'))
      onChanged()
    },
    onError: (e) => {
      setError(t('review.code.verdict.failed'))
      toast.error(e)
    },
  })

  const changed = verdict !== null && (verdict !== current?.verdict || note.trim() !== (current?.note ?? ''))

  return (
    <div className="space-y-3 rounded-(--radius) border border-border p-4" data-testid="code-verdict">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{t('review.code.verdict.title')}</h4>
        <p className="text-xs text-muted">{t('review.code.advisory')}</p>
      </div>
      {current && (
        <p className="text-sm">
          <Badge tone={current.verdict === 'accepted' ? 'success' : 'error'}>{t(`review.code.verdict.${current.verdict}`)}</Badge>{' '}
          <span className="text-xs text-muted">{t('review.code.verdict.by', { name: current.by_name ?? '', when: formatDateTime(current.at, tz) })}</span>
        </p>
      )}
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">{t('review.code.verdict.title')}</legend>
        {(['accepted', 'not_acceptable'] as const).map((v) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name={`verdict-${s.question_id}`} checked={verdict === v} onChange={() => setVerdict(v)} />
            {t(`review.code.verdict.${v}`)}
          </label>
        ))}
      </fieldset>
      <Textarea
        label={t('review.code.verdict.note')}
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="text-xs text-muted">{t('review.code.verdict.noteCount', { count: note.length, max: NOTE_MAX })}</p>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      <Button size="sm" loading={save.isPending} disabled={!changed} onClick={() => save.mutate()}>
        {t(current ? 'review.code.verdict.change' : 'review.code.verdict.save')}
      </Button>
    </div>
  )
}

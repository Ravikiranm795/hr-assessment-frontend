import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { applyServerMessage } from './serverErrors'
import { cn, formatNumber } from '@/core/utils'
import type { AnswerRow, Attempt } from './types'
import { Badge } from '@/components/Badge'
import { Html } from '@/components/Html'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'

interface Option {
  id: string
  text_html: string
  is_correct: boolean
}
interface Accepted {
  accepted: string[]
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const asRecord = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export function AnswersTab({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const rescore = useMutation({
    mutationFn: () => api.post(`/api/v1/attempts/${attempt.id}/rescore`),
    onSuccess: () => {
      toast.success(t('review.toast.rescored'))
      onChanged()
    },
    onError: toast.error,
  })

  return (
    <div className="space-y-4">
      {attempt.scoring_status === 'needs_manual' && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" loading={rescore.isPending} onClick={() => rescore.mutate()}>
            {t('review.answers.rescore')}
          </Button>
        </div>
      )}
      {attempt.breakdown.map((q) => (
        <QuestionCard key={q.question_id} q={q} attempt={attempt} onChanged={onChanged} />
      ))}
    </div>
  )
}

function QuestionCard({ q, attempt, onChanged }: { q: AnswerRow; attempt: Attempt; onChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const needsManual = attempt.scoring_status === 'needs_manual' && q.scoring_mode !== 'auto' && q.ai_marks === null && q.manual_marks === null
  const typeKey = `review.answers.type.${q.type}`

  return (
    <article className="rounded-(--radius) border border-border bg-surface p-5 shadow-card" aria-label={t('review.answers.question', { n: q.position })}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{t('review.answers.question', { n: q.position })}</h3>
          <Badge>{i18n.exists(typeKey) ? t(typeKey) : q.type}</Badge>
          {q.scored_by && <Badge tone="info">{t(`review.answers.scoredBy.${q.scored_by}`, { defaultValue: q.scored_by })}</Badge>}
          {needsManual && <Badge tone="warning">{t('review.answers.needsManual')}</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{t('review.answers.marks', { got: formatNumber(q.final_marks ?? 0), total: formatNumber(q.marks) })}</span>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t('review.answers.override')}
          </Button>
        </div>
      </header>
      <Html html={q.prompt_html} className="mt-3" />
      <AnswerView q={q} />
      {q.ai_reason && (
        <p className="mt-3 text-sm">
          <span className="font-medium">{t('review.answers.aiReason')}: </span>
          {q.ai_reason}
        </p>
      )}
      {q.manual_reason && (
        <p className="mt-1 text-sm">
          <span className="font-medium">{t('review.answers.manualReason')}: </span>
          {q.manual_reason}
        </p>
      )}
      <OverrideScore open={open} onOpenChange={setOpen} q={q} attemptId={attempt.id} onSaved={onChanged} />
    </article>
  )
}

/** The candidate's answer against the key, by question type. Keys are shown to reviewers only. */
function AnswerView({ q }: { q: AnswerRow }) {
  const { t } = useTranslation()
  const answer = asRecord(q.answer)
  const key = asRecord(q.answer_key)

  if (q.type === 'single_choice' || q.type === 'multi_choice') {
    const chosen = new Set<string>(q.type === 'single_choice' ? [String(answer.option_id ?? '')] : asArray<string>(answer.option_ids))
    const options = asArray<Option>(q.options)
    return (
      <ul className="mt-3 space-y-1.5" aria-label={t('review.answers.yourAnswer')}>
        {options.map((o) => {
          const picked = chosen.has(o.id)
          return (
            <li
              key={o.id}
              className={cn(
                'flex items-center gap-2 rounded-(--radius) border px-3 py-2 text-sm',
                picked && o.is_correct && 'border-success/40 bg-success/10',
                picked && !o.is_correct && 'border-error/40 bg-error/10',
                !picked && o.is_correct && 'border-success/40',
                !picked && !o.is_correct && 'border-border',
              )}
            >
              <span aria-hidden className="w-4 text-center">{picked ? '●' : '○'}</span>
              <Html html={o.text_html} />
              {o.is_correct && <Badge tone="success">{t('review.answers.correct')}</Badge>}
            </li>
          )
        })}
        {chosen.size === 0 || (chosen.size === 1 && chosen.has('')) ? <li className="text-sm text-muted">{t('review.answers.noAnswer')}</li> : null}
      </ul>
    )
  }

  if (q.type === 'fill_blank' || q.type === 'code_gap') {
    const given = asArray<string>(q.type === 'fill_blank' ? answer.blanks : answer.gaps)
    const expected = asArray<Accepted>(q.type === 'fill_blank' ? key.blanks : key.gaps)
    const count = Math.max(given.length, expected.length)
    return (
      <ul className="mt-3 space-y-1.5">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="grid grid-cols-[6rem_1fr_1fr] gap-3 text-sm">
            <span className="text-muted">{t('review.answers.blank', { n: i + 1 })}</span>
            <span className={cn('rounded border border-border px-2 py-1', q.type === 'code_gap' && 'font-mono')}>{given[i] || t('review.answers.noAnswer')}</span>
            <span className={cn('rounded border border-success/40 px-2 py-1', q.type === 'code_gap' && 'font-mono')}>
              <span className="sr-only">{t('review.answers.correct')}: </span>
              {(expected[i]?.accepted ?? []).join(' / ')}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  const text = typeof answer.text === 'string' ? answer.text : ''
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div>
        <p className="font-medium">{t('review.answers.yourAnswer')}</p>
        <p className="mt-1 rounded border border-border p-3 whitespace-pre-wrap">{text || t('review.answers.noAnswer')}</p>
      </div>
      {q.model_answer && (
        <div>
          <p className="font-medium">{t('review.answers.modelAnswer')}</p>
          <p className="mt-1 rounded border border-success/40 p-3 whitespace-pre-wrap">{q.model_answer}</p>
        </div>
      )}
    </div>
  )
}

function OverrideScore({
  open,
  onOpenChange,
  q,
  attemptId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  q: AnswerRow
  attemptId: string
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [marks, setMarks] = useState(String(q.final_marks ?? 0))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => api.patch(`/api/v1/attempts/${attemptId}/answers/${q.question_id}/score`, { marks: Number(marks), reason: reason.trim() }),
    onSuccess: () => {
      toast.success(t('review.toast.scored'))
      onOpenChange(false)
      setReason('')
      onSaved()
    },
    onError: (e) => setError(applyServerMessage(e)),
  })

  const value = Number(marks)
  const valid = marks.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= q.marks && reason.trim().length > 0

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('review.answers.overrideTitle')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={`marks-${q.question_id}`} className="block text-sm font-medium">
            {t('review.answers.marksLabel', { max: q.marks })}
          </label>
          <input
            id={`marks-${q.question_id}`}
            type="number"
            min={0}
            max={q.marks}
            step="0.5"
            className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
          />
        </div>
        <Textarea label={t('review.answers.reasonLabel')} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!valid}>
            {t('review.answers.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

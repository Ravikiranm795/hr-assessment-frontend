import type { HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Textarea } from '@/components/Textarea'
import { cn } from '@/core/utils'
import { ALLOWED_SCORING } from '../api'
import { RichTextEditor } from '../ui/RichTextEditor'
import { SelectField } from '../ui/controls'
import { CODE_LANGUAGES, questionIssues, uid, type DraftQuestion } from './model'

interface QuestionCardProps {
  q: DraftQuestion
  index: number
  readOnly: boolean
  showProblems: boolean
  /** Feature flag `ai_scoring`: AI is offered as a scoring mode only when on. */
  aiScoring: boolean
  onPatch: (patch: Partial<DraftQuestion>) => void
  onRemove: () => void
  handleProps?: HTMLAttributes<HTMLButtonElement>
}

/** One editable question: rich prompt, type-specific answer key, marks and scoring mode (spec F4). */
export function QuestionCard({ q, index, readOnly, showProblems, aiScoring, onPatch, onRemove, handleProps }: QuestionCardProps) {
  const { t } = useTranslation()
  const issues = showProblems ? questionIssues(q) : []
  const choice = q.type === 'single_choice' || q.type === 'multi_choice'
  const gapLike = q.type === 'fill_blank' || q.type === 'code_gap'
  const mono = q.type === 'code_gap'
  const showModelAnswer = q.type === 'short_answer' || (q.type === 'code_gap' && q.scoring_mode !== 'auto')
  const scoringOptions = ALLOWED_SCORING[q.type].filter((m) => m !== 'ai' || aiScoring || q.scoring_mode === 'ai')

  return (
    <section
      id={`question-${q.key}`}
      aria-label={t('assessments.question.label', { n: index + 1 })}
      className="rounded-(--radius) border border-border bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {!readOnly && (
          <button
            type="button"
            className="cursor-grab rounded px-2 py-1 text-muted hover:bg-bg hover:text-text"
            aria-label={t('assessments.question.drag', { n: index + 1 })}
            {...handleProps}
          >
            ⠿
          </button>
        )}
        <h3 className="text-sm font-semibold">{t('assessments.question.label', { n: index + 1 })}</h3>
        <Badge tone="info">{t(`assessments.question_type.${q.type}`)}</Badge>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs font-medium">
            <span className="block">{t('assessments.question.marks')}</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={q.marks}
              disabled={readOnly}
              onChange={(e) => onPatch({ marks: e.target.value })}
              aria-invalid={issues.includes('marks_invalid') || undefined}
              className={cn('h-9 w-20 rounded-(--radius) border bg-surface px-2 text-sm disabled:bg-bg', issues.includes('marks_invalid') ? 'border-error' : 'border-border')}
            />
          </label>
          <SelectField
            label={t('assessments.question.scoring')}
            value={q.scoring_mode}
            disabled={readOnly || scoringOptions.length === 1}
            className="h-9 w-40"
            onChange={(e) => onPatch({ scoring_mode: e.target.value as DraftQuestion['scoring_mode'] })}
          >
            {scoringOptions.map((m) => (
              <option key={m} value={m}>
                {t(`assessments.scoring.${m}`)}
              </option>
            ))}
          </SelectField>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={onRemove} aria-label={t('assessments.question.remove', { n: index + 1 })}>
              {t('assessments.question.removeShort')}
            </Button>
          )}
        </div>
      </div>

      <RichTextEditor
        label={t('assessments.question.prompt')}
        value={q.prompt_html}
        disabled={readOnly}
        mono={mono}
        invalid={issues.includes('prompt_empty')}
        onChange={(html) => onPatch({ prompt_html: html })}
      />

      <div className="mt-4 space-y-3">
        {choice && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('assessments.question.options')}</legend>
            <p className="text-xs text-muted">{t(q.type === 'single_choice' ? 'assessments.question.optionsHintSingle' : 'assessments.question.optionsHintMulti')}</p>
            {q.options.map((o, i) => (
              <div key={o.key} className="flex items-start gap-2">
                <input
                  type={q.type === 'single_choice' ? 'radio' : 'checkbox'}
                  name={`correct-${q.key}`}
                  checked={o.is_correct}
                  disabled={readOnly}
                  aria-label={t('assessments.question.markCorrect', { n: i + 1 })}
                  className="mt-3"
                  onChange={(e) =>
                    onPatch({
                      options: q.options.map((x) =>
                        x.key === o.key ? { ...x, is_correct: e.target.checked } : q.type === 'single_choice' ? { ...x, is_correct: false } : x,
                      ),
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <RichTextEditor
                    compact
                    hideLabel
                    label={t('assessments.question.optionN', { n: i + 1 })}
                    value={o.text_html}
                    disabled={readOnly}
                    onChange={(html) => onPatch({ options: q.options.map((x) => (x.key === o.key ? { ...x, text_html: html } : x)) })}
                  />
                </div>
                {!readOnly && q.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('assessments.question.removeOption', { n: i + 1 })}
                    onClick={() => onPatch({ options: q.options.filter((x) => x.key !== o.key) })}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => onPatch({ options: [...q.options, { key: uid(), text_html: '', is_correct: false }] })}>
                {t('assessments.question.addOption')}
              </Button>
            )}
            {q.type === 'multi_choice' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.partial} disabled={readOnly} onChange={(e) => onPatch({ partial: e.target.checked })} />
                {t('assessments.question.partial')}
              </label>
            )}
          </fieldset>
        )}

        {gapLike && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t(q.type === 'fill_blank' ? 'assessments.question.blanks' : 'assessments.question.gaps')}</legend>
            <p className="text-xs text-muted">{t('assessments.question.slotsHint')}</p>
            {q.slots.map((s, i) => (
              <div key={s.key} className="flex items-start gap-2">
                <div className="flex-1">
                  <Textarea
                    label={t(q.type === 'fill_blank' ? 'assessments.question.blankN' : 'assessments.question.gapN', { n: i + 1 })}
                    value={s.accepted}
                    disabled={readOnly}
                    rows={2}
                    className={cn(mono && 'font-mono')}
                    onChange={(e) => onPatch({ slots: q.slots.map((x) => (x.key === s.key ? { ...x, accepted: e.target.value } : x)) })}
                  />
                </div>
                {!readOnly && q.slots.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-6"
                    aria-label={t('assessments.question.removeSlot', { n: i + 1 })}
                    onClick={() => onPatch({ slots: q.slots.filter((x) => x.key !== s.key) })}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4">
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => onPatch({ slots: [...q.slots, { key: uid(), accepted: '' }] })}>
                  {t(q.type === 'fill_blank' ? 'assessments.question.addBlank' : 'assessments.question.addGap')}
                </Button>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.case_sensitive} disabled={readOnly} onChange={(e) => onPatch({ case_sensitive: e.target.checked })} />
                {t('assessments.question.caseSensitive')}
              </label>
            </div>
          </fieldset>
        )}

        {q.type === 'code_gap' && (
          <div className="max-w-xs">
            <SelectField
              label={t('assessments.question.language')}
              value={q.code_language}
              disabled={readOnly}
              onChange={(e) => onPatch({ code_language: e.target.value })}
            >
              <option value="">{t('assessments.language.none')}</option>
              {CODE_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {t(`assessments.language.${l}`)}
                </option>
              ))}
            </SelectField>
          </div>
        )}

        {showModelAnswer && (
          <div className="space-y-3">
            <p className="text-xs text-muted">{t(q.scoring_mode === 'ai' ? 'assessments.question.aiNeedsAnswer' : 'assessments.question.modelOptional')}</p>
            <Textarea
              label={t('assessments.question.modelAnswer')}
              value={q.model_answer}
              disabled={readOnly}
              error={q.fieldErrors.model_answer ?? (issues.includes('model_answer_required') ? t('assessments.issue.model_answer_required') : undefined)}
              onChange={(e) => onPatch({ model_answer: e.target.value })}
            />
            <Textarea
              label={t('assessments.question.keyPoints')}
              value={q.key_points}
              disabled={readOnly}
              rows={2}
              onChange={(e) => onPatch({ key_points: e.target.value })}
            />
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <ul role="alert" className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-error">
          {issues.map((code) => (
            <li key={code}>{t(`assessments.issue.${code}`)}</li>
          ))}
        </ul>
      )}
      {q.error && (
        <p role="alert" className="mt-3 text-xs text-error">
          {q.error}
        </p>
      )}
    </section>
  )
}

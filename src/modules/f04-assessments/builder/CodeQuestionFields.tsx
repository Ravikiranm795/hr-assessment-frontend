import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { CodeEditor } from '@/components/code-editor/CodeEditor'
import { CODE_LANGUAGES, isCodeLanguage, type CodeLanguage } from '@/components/code-editor/languages'
import { LanguageSelect } from '@/components/code-editor/LanguageSelect'
import { Field } from '@/components/Field'
import { Textarea } from '@/components/Textarea'
import { cn } from '@/core/utils'
import { MAX_MINUTES, MAX_SAMPLES, MIN_MINUTES, uid, type DraftQuestion, type IssueCode } from './model'

interface Props {
  q: DraftQuestion
  readOnly: boolean
  issues: IssueCode[]
  onPatch: (patch: Partial<DraftQuestion>) => void
}

/** Editor part of a coding question (type code_write): minutes, languages, samples, starter code, AI hints. */
export function CodeQuestionFields({ q, readOnly, issues, onPatch }: Props) {
  const { t } = useTranslation()
  const allowed = q.languages.filter(isCodeLanguage)
  const defaultLanguage: CodeLanguage = isCodeLanguage(q.code_language) && allowed.includes(q.code_language) ? q.code_language : (allowed[0] ?? 'python')

  const toggleLanguage = (id: CodeLanguage, on: boolean) => {
    const languages = on ? [...q.languages, id] : q.languages.filter((l) => l !== id)
    const code_language = languages.includes(q.code_language) ? q.code_language : (languages[0] ?? '')
    onPatch({ languages, code_language })
  }

  return (
    <div className="space-y-4" data-testid="code-question-fields">
      <p className="rounded-(--radius) border border-border bg-bg p-2 text-xs text-muted">{t('assessments.code.noMarks')}</p>

      <div className="max-w-xs">
        <Field
          type="number"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          label={t('assessments.code.minutes')}
          hint={t('assessments.code.minutesHint', { min: MIN_MINUTES, max: MAX_MINUTES })}
          value={q.duration}
          disabled={readOnly}
          error={issues.includes('duration_missing') ? t('assessments.issue.duration_missing') : undefined}
          onChange={(e) => onPatch({ duration: e.target.value })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('assessments.code.languages')}</legend>
        <p className="text-xs text-muted">{t('assessments.code.languagesHint')}</p>
        <div className="flex flex-wrap gap-4">
          {CODE_LANGUAGES.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={q.languages.includes(l.id)} disabled={readOnly} onChange={(e) => toggleLanguage(l.id, e.target.checked)} />
              {l.label}
            </label>
          ))}
        </div>
        {issues.includes('no_languages') && <p className="text-xs text-error">{t('assessments.issue.no_languages')}</p>}
        {allowed.length > 0 && (
          <LanguageSelect
            label={t('assessments.code.defaultLanguage')}
            value={defaultLanguage}
            allowed={allowed}
            disabled={readOnly}
            onChange={(language) => onPatch({ code_language: language })}
          />
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('assessments.code.samples')}</legend>
        <p className="text-xs text-muted">{t('assessments.code.samplesHint', { max: MAX_SAMPLES })}</p>
        {q.samples.map((s, i) => (
          <div key={s.key} className="flex items-start gap-2 rounded-(--radius) border border-border p-3">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <Textarea
                label={t('assessments.code.sampleInput', { n: i + 1 })}
                value={s.input}
                disabled={readOnly}
                rows={3}
                className="font-mono"
                onChange={(e) => onPatch({ samples: q.samples.map((x) => (x.key === s.key ? { ...x, input: e.target.value } : x)) })}
              />
              <Textarea
                label={t('assessments.code.sampleExpected', { n: i + 1 })}
                value={s.expected}
                disabled={readOnly}
                rows={3}
                className="font-mono"
                onChange={(e) => onPatch({ samples: q.samples.map((x) => (x.key === s.key ? { ...x, expected: e.target.value } : x)) })}
              />
            </div>
            {!readOnly && q.samples.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-6"
                aria-label={t('assessments.code.removeSample', { n: i + 1 })}
                onClick={() => onPatch({ samples: q.samples.filter((x) => x.key !== s.key) })}
              >
                ×
              </Button>
            )}
          </div>
        ))}
        {issues.includes('no_samples') && <p className="text-xs text-error">{t('assessments.issue.no_samples')}</p>}
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            disabled={q.samples.length >= MAX_SAMPLES}
            onClick={() => onPatch({ samples: [...q.samples, { key: uid(), input: '', expected: '' }] })}
          >
            {t('assessments.code.addSample')}
          </Button>
        )}
      </fieldset>

      <div className="space-y-1">
        <p className="text-sm font-medium">{t('assessments.code.starter')}</p>
        <p className="text-xs text-muted">{t('assessments.code.starterHint')}</p>
        <CodeEditor
          value={q.starter_code}
          onChange={(v) => onPatch({ starter_code: v })}
          language={defaultLanguage}
          label={t('assessments.code.starter')}
          readOnly={readOnly}
          height="12rem"
        />
      </div>

      <div className="space-y-2 rounded-(--radius) border border-border bg-bg p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            checked={q.scoring_mode === 'ai'}
            disabled={readOnly}
            onChange={(e) => onPatch({ scoring_mode: e.target.checked ? 'ai' : 'manual' })}
          />
          {t('assessments.code.aiReview')}
        </label>
        <p className={cn('text-xs text-muted')}>{t('assessments.code.aiReviewHint')}</p>
        <Textarea
          label={t('assessments.code.keyPoints')}
          value={q.key_points}
          disabled={readOnly}
          rows={3}
          onChange={(e) => onPatch({ key_points: e.target.value })}
        />
        <p className="text-xs text-muted">{t('assessments.code.keyPointsHint')}</p>
        <Textarea
          label={t('assessments.code.modelAnswer')}
          value={q.model_answer}
          disabled={readOnly}
          rows={4}
          className="font-mono"
          error={q.fieldErrors.model_answer}
          onChange={(e) => onPatch({ model_answer: e.target.value })}
        />
      </div>
    </div>
  )
}

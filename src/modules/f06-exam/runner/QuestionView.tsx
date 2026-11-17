import { useTranslation } from 'react-i18next'
import { Html } from '@/components/Html'
import { Textarea } from '@/components/Textarea'
import { cn } from '@/core/utils'
import type { AnswerValue, ExamQuestion } from '../types'

export type AnswerKind = 'text' | 'choice'

/** Whether a saved answer counts as answered in the palette. Tolerates any shape the server returns. */
export function isAnswered(question: ExamQuestion, answer: unknown): boolean {
  if (!answer || typeof answer !== 'object') return false
  const a = answer as Record<string, unknown>
  switch (question.type) {
    case 'single_choice':
      return typeof a.option_id === 'string' && a.option_id !== ''
    case 'multi_choice':
      return Array.isArray(a.option_ids) && a.option_ids.length > 0
    case 'fill_blank':
      return Array.isArray(a.blanks) && a.blanks.some((v) => typeof v === 'string' && v.trim() !== '')
    case 'code_gap':
      return Array.isArray(a.gaps) && a.gaps.some((v) => typeof v === 'string' && v.trim() !== '')
    default:
      return typeof a.text === 'string' && a.text.trim() !== ''
  }
}

const strings = (value: unknown, length: number): string[] => {
  const list = Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v : '')) : []
  return Array.from({ length }, (_, i) => list[i] ?? '')
}

interface QuestionViewProps {
  question: ExamQuestion
  index: number
  total: number
  answer: unknown
  onChange: (value: AnswerValue, kind: AnswerKind) => void
}

const optionClass =
  'flex cursor-pointer items-start gap-3 rounded-(--radius) border border-border bg-surface px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5'
const inputClass = 'h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm'

export function QuestionView({ question, index, total, answer, onChange }: QuestionViewProps) {
  const { t } = useTranslation()
  const a = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>
  const headingId = `question-${question.id}`

  const slots = question.blank_count && question.blank_count > 0 ? question.blank_count : 1
  const isCode = question.type === 'code_gap'

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <header className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} tabIndex={-1} className="text-lg font-semibold outline-none">
          {t('exam.question.heading', { number: index + 1, total })}
        </h2>
        <p className="text-sm text-muted">{t('exam.question.marks', { count: question.marks })}</p>
      </header>

      <Html html={question.prompt_html} className={cn('leading-relaxed', isCode && 'font-mono text-sm')} />

      {question.type === 'single_choice' && (
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('exam.question.chooseOne')}</legend>
          {question.options.map((option) => (
            <label key={option.id} className={optionClass}>
              <input
                type="radio"
                name={headingId}
                className="mt-1"
                checked={a.option_id === option.id}
                onChange={() => onChange({ option_id: option.id }, 'choice')}
              />
              <Html html={option.text_html} />
            </label>
          ))}
        </fieldset>
      )}

      {question.type === 'multi_choice' && (
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('exam.question.chooseMany')}</legend>
          {question.options.map((option) => {
            const chosen = Array.isArray(a.option_ids) ? (a.option_ids as string[]) : []
            const checked = chosen.includes(option.id)
            return (
              <label key={option.id} className={optionClass}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      { option_ids: checked ? chosen.filter((id) => id !== option.id) : [...chosen, option.id] },
                      'choice',
                    )
                  }
                />
                <Html html={option.text_html} />
              </label>
            )
          })}
        </fieldset>
      )}

      {(question.type === 'fill_blank' || isCode) && (
        <div className="space-y-3">
          {strings(isCode ? a.gaps : a.blanks, slots).map((value, i, all) => (
            <div key={i} className="space-y-1.5">
              <label htmlFor={`${headingId}-slot-${i}`} className="block text-sm font-medium">
                {t(isCode ? 'exam.question.gap' : 'exam.question.blank', { number: i + 1 })}
              </label>
              <input
                id={`${headingId}-slot-${i}`}
                type="text"
                value={value}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={cn(inputClass, isCode && 'font-mono')}
                onChange={(e) => {
                  const next = all.slice()
                  next[i] = e.target.value
                  onChange(isCode ? { gaps: next } : { blanks: next }, 'text')
                }}
              />
            </div>
          ))}
        </div>
      )}

      {question.type === 'short_answer' && (
        <Textarea
          label={t('exam.question.yourAnswer')}
          rows={8}
          value={typeof a.text === 'string' ? a.text : ''}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange({ text: e.target.value }, 'text')}
        />
      )}
    </section>
  )
}

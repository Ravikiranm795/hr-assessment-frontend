import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'
import type { PreviewOut } from '../api'
import { SafeHtml } from '../ui/SafeHtml'

/** Read-only rendering of the backend's candidate preview. Nothing here is editable or submittable. */
export function CandidatePreview({ preview }: { preview: PreviewOut }) {
  const { t } = useTranslation()
  const { header } = preview
  return (
    <div className="relative overflow-hidden rounded-(--radius) border border-border bg-bg p-5" data-testid="candidate-preview">
      {preview.watermark && (
        <div
          aria-hidden
          data-testid="preview-watermark"
          className="pointer-events-none absolute inset-0 z-10 flex rotate-[-20deg] flex-wrap content-around justify-around gap-x-16 gap-y-24 overflow-hidden text-lg font-semibold text-navy/10 select-none"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i}>{preview.watermark}</span>
          ))}
        </div>
      )}

      <header className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <p className="text-lg font-semibold" data-testid="preview-company">
          {header.company_name ?? ''}
        </p>
        <p className="text-sm text-muted">
          {t('assessments.preview.meta', { minutes: preview.duration_minutes, marks: preview.total_marks })}
        </p>
      </header>

      {preview.instructions_html && (
        <section className="mb-4 rounded-(--radius) border border-border bg-surface p-4">
          <h3 className="mb-1 text-sm font-semibold">{t('assessments.preview.instructions')}</h3>
          <SafeHtml html={preview.instructions_html} />
        </section>
      )}

      {preview.questions.length === 0 && <p className="text-sm text-muted">{t('assessments.preview.noQuestions')}</p>}

      <ol className="space-y-4">
        {preview.questions.map((q, index) => (
          <li key={q.id} className="rounded-(--radius) border border-border bg-surface p-4">
            <div className="mb-2 flex items-start justify-between gap-4">
              <span className="text-sm font-medium">{t('assessments.preview.questionNo', { n: index + 1 })}</span>
              <span className="text-xs text-muted">{t('assessments.preview.marks', { marks: q.marks })}</span>
            </div>
            <SafeHtml html={q.prompt_html} className={cn(q.type === 'code_gap' && 'font-mono')} />
            <div className="mt-3 space-y-2">
              {(q.type === 'single_choice' || q.type === 'multi_choice') &&
                q.options.map((o) => (
                  <label key={o.id} className="flex items-start gap-2 text-sm">
                    <input type={q.type === 'single_choice' ? 'radio' : 'checkbox'} disabled name={q.id} className="mt-1" />
                    <SafeHtml html={o.text_html} />
                  </label>
                ))}
              {(q.type === 'fill_blank' || q.type === 'code_gap') &&
                Array.from({ length: q.blank_count ?? 0 }, (_, i) => (
                  <input
                    key={i}
                    disabled
                    aria-label={t('assessments.preview.blankNo', { n: i + 1 })}
                    placeholder={t('assessments.preview.blankNo', { n: i + 1 })}
                    className={cn('block h-9 w-64 rounded-(--radius) border border-border bg-bg px-3 text-sm', q.type === 'code_gap' && 'font-mono')}
                  />
                ))}
              {q.type === 'short_answer' && (
                <textarea disabled aria-label={t('assessments.preview.yourAnswer')} className="min-h-20 w-full rounded-(--radius) border border-border bg-bg p-2 text-sm" />
              )}
            </div>
          </li>
        ))}
      </ol>

      {preview.footer_html && (
        <footer className="mt-4 border-t border-border pt-3 text-muted" data-testid="preview-footer">
          <SafeHtml html={preview.footer_html} className="text-xs" />
        </footer>
      )}
    </div>
  )
}

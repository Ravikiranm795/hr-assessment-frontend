import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { cn } from '@/core/utils'
import type { ExamSection } from '../types'
import { formatClock } from './useServerClock'

export const isClosed = (s: ExamSection) => s.state === 'submitted' || s.state === 'expired'

/** "Multiple-choice questions" or "Coding question 2: Reverse a string". */
export function sectionName(t: TFunction, section: ExamSection, all: ExamSection[], withTitle = true): string {
  if (section.kind === 'mcq') return t('exam.sections.mcq')
  const number = all.filter((s) => s.kind === 'code' && s.position <= section.position).length
  return section.title && withTitle
    ? t('exam.sections.codeWithTitle', { number, title: section.title })
    : t('exam.sections.code', { number })
}

export function stateLabel(t: TFunction, state: string): string {
  const key = `exam.sections.state.${state}`
  return t(key, { defaultValue: state })
}

interface SectionOverviewProps {
  sections: ExamSection[]
  activeKey: string | null
  /** Live remaining seconds of the running section (the page clock); others show the stored value. */
  activeLeft: number | null
  busyKey: string | null
  submitting: boolean
  onEnter: (key: string) => void
  onSubmitAll: () => void
}

export function SectionOverview({ sections, activeKey, activeLeft, busyKey, submitting, onEnter, onSubmitAll }: SectionOverviewProps) {
  const { t } = useTranslation()
  const allClosed = sections.length > 0 && sections.every(isClosed)
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('exam.sections.title')}</h1>
        <p className="text-sm text-muted">{t('exam.sections.intro')}</p>
        {activeKey && <p className="text-sm text-muted">{t('exam.sections.running')}</p>}
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const closed = isClosed(section)
          const running = section.key === activeKey
          const seconds = running && activeLeft !== null ? activeLeft : section.remaining_seconds
          const name = sectionName(t, section, sections)
          const headingId = `section-card-${section.key}`
          const started = section.state === 'running' || section.state === 'paused'
          const actionLabel = closed ? t('exam.sections.closedNote') : t(started ? 'exam.sections.resume' : 'exam.sections.enter')
          return (
            <li
              key={section.key}
              aria-labelledby={headingId}
              className={cn(
                'flex flex-col justify-between gap-4 rounded-(--radius) border bg-surface p-5',
                running ? 'border-primary' : 'border-border',
                closed && 'opacity-70',
              )}
            >
              <div className="space-y-2">
                <h2 id={headingId} className="font-semibold">
                  {name}
                </h2>
                <p className="text-sm text-muted">
                  {section.kind === 'mcq' && <>{t('exam.sections.mcqMeta', { count: section.question_count })} · </>}
                  {t('exam.sections.minutes', { minutes: Math.round(section.duration_seconds / 60) })}
                </p>
                <p className="text-sm">
                  <span className="font-medium">{stateLabel(t, section.state)}</span>
                  {!closed && (
                    <span className="text-muted">
                      {' · '}
                      {t('exam.sections.left')}{' '}
                      <span className="font-mono tabular-nums">{formatClock(seconds)}</span>
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant={closed ? 'outline' : 'primary'}
                disabled={closed || submitting}
                loading={busyKey === section.key}
                aria-label={t('exam.sections.actionNamed', { action: actionLabel, name })}
                onClick={() => onEnter(section.key)}
              >
                {actionLabel}
              </Button>
            </li>
          )
        })}
      </ul>

      <div className="space-y-3 rounded-(--radius) border border-border bg-surface p-5">
        {allClosed && <p role="status" className="text-sm">{t('exam.sections.allClosed')}</p>}
        <Button variant={allClosed ? 'primary' : 'outline'} loading={submitting} onClick={onSubmitAll}>
          {t(allClosed ? 'exam.sections.submitAll' : 'exam.sections.submitEarly')}
        </Button>
      </div>
    </div>
  )
}

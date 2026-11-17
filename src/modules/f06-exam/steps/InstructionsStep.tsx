import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Html } from '@/components/Html'
import { HelpPanel } from '../HelpPanel'
import { useFocusOnMount } from '../Screens'
import { readAccommodations, type ExamState } from '../types'

interface InstructionsStepProps {
  state: ExamState
  onContinue: () => void
  onHelpResolved: () => void
}

const RULES = ['alone', 'noHelp', 'noLeave', 'fullscreen', 'timer', 'autosave'] as const
const MONITORED = ['screen', 'tabs', 'camera', 'keys'] as const

export function InstructionsStep({ state, onContinue, onHelpResolved }: InstructionsStepProps) {
  const { t } = useTranslation()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  const accommodations = readAccommodations(state)
  const hasBadges = accommodations.cameraExempt || accommodations.timeMultiplier !== 1 || accommodations.extraMinutes > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t('exam.instructions.title')}
        </h1>
        <p className="mt-2 text-muted">
          {t('exam.instructions.summary', { minutes: state.duration_minutes, count: state.question_count })}
        </p>
      </div>

      {hasBadges && (
        <section aria-labelledby="accommodations-heading" className="space-y-2">
          <h2 id="accommodations-heading" className="text-sm font-medium">
            {t('exam.instructions.accommodations')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {accommodations.cameraExempt && <Badge>{t('exam.instructions.badge.cameraExempt')}</Badge>}
            {accommodations.timeMultiplier !== 1 && (
              <Badge>{t('exam.instructions.badge.timeMultiplier', { multiplier: accommodations.timeMultiplier })}</Badge>
            )}
            {accommodations.extraMinutes > 0 && (
              <Badge>{t('exam.instructions.badge.extraMinutes', { minutes: accommodations.extraMinutes })}</Badge>
            )}
          </div>
        </section>
      )}

      {state.instructions_html && <Html html={state.instructions_html} className="leading-relaxed" />}

      <section aria-labelledby="rules-heading" className="space-y-2">
        <h2 id="rules-heading" className="text-lg font-semibold">
          {t('exam.instructions.rules')}
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {RULES.map((key) => (
            <li key={key}>{t(`exam.instructions.rule.${key}`)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="monitored-heading" className="space-y-2">
        <h2 id="monitored-heading" className="text-lg font-semibold">
          {t('exam.instructions.monitored')}
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {MONITORED.filter((key) => key !== 'camera' || state.camera_required).map((key) => (
            <li key={key}>{t(`exam.instructions.monitor.${key}`)}</li>
          ))}
        </ul>
        {state.camera_required && (
          <p className="rounded-(--radius) border border-border bg-surface p-3 text-sm">
            {t('exam.instructions.cameraNotice')}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="lg" onClick={onContinue}>
          {t('exam.instructions.continue')}
        </Button>
        <HelpPanel pending={state.help_request_pending} onResolved={onHelpResolved} />
      </div>
    </div>
  )
}

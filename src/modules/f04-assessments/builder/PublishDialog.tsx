import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import i18n from '@/core/i18n'

export interface PublishProblem {
  /** Client key of the question, when known (jumps to its card). */
  questionKey: string | null
  position: number | null
  code: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  problems: PublishProblem[]
  onJump: (questionKey: string) => void
}

/** Publish is refused until these are fixed: shown before anything is frozen (spec F4). */
export function PublishProblemsDialog({ open, onOpenChange, problems, onJump }: Props) {
  const { t } = useTranslation()
  const text = (code: string) => (i18n.exists(`assessments.issue.${code}`) ? t(`assessments.issue.${code}`) : t('assessments.issue.unknown'))
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('assessments.publish.problemsTitle')} description={t('assessments.publish.problemsBody')} wide>
      <ul className="space-y-2" data-testid="publish-problems">
        {problems.map((p, i) => (
          <li key={`${p.questionKey}-${p.code}-${i}`} className="flex items-center justify-between gap-3 rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm">
            <span>
              {p.position ? <strong>{t('assessments.question.label', { n: p.position })}: </strong> : null}
              {text(p.code)}
            </span>
            {p.questionKey && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onJump(p.questionKey as string)
                }}
              >
                {t('assessments.publish.goTo')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.close')}
        </Button>
      </div>
    </Modal>
  )
}

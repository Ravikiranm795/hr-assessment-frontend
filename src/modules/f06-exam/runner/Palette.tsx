import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'

interface PaletteProps {
  total: number
  current: number
  answered: boolean[]
  onSelect: (index: number) => void
}

/** Question palette: current, answered and unanswered are told apart by shape and text, not by colour alone. */
export function Palette({ total, current, answered, onSelect }: PaletteProps) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('exam.palette.label')}>
      <ol className="grid grid-cols-5 gap-2">
        {Array.from({ length: total }, (_, i) => {
          const done = answered[i]
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={i === current ? 'step' : undefined}
                aria-label={t(done ? 'exam.palette.answered' : 'exam.palette.unanswered', { number: i + 1 })}
                className={cn(
                  'h-10 w-full rounded-(--radius) border text-sm font-medium',
                  done ? 'border-primary bg-primary/10' : 'border-dashed border-border bg-surface',
                  i === current && 'border-2 border-solid border-primary bg-primary text-primary-contrast',
                )}
              >
                {i + 1}
              </button>
            </li>
          )
        })}
      </ol>
      <dl className="mt-4 space-y-1 text-xs text-muted">
        <div className="flex items-center gap-2">
          <dt className="size-3 rounded-sm bg-primary" aria-hidden />
          <dd>{t('exam.palette.legendCurrent')}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="size-3 rounded-sm border border-primary bg-primary/10" aria-hidden />
          <dd>{t('exam.palette.legendAnswered')}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="size-3 rounded-sm border border-dashed border-border" aria-hidden />
          <dd>{t('exam.palette.legendUnanswered')}</dd>
        </div>
      </dl>
    </nav>
  )
}

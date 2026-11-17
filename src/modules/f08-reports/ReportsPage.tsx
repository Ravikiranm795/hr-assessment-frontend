import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AskPanel } from './AskPanel'
import { BuilderPanel } from './BuilderPanel'
import { ConfirmedPanel } from './ConfirmedPanel'
import { HistoryList } from './HistoryList'
import type { Report, Scope } from './types'

/** One screen for both scopes: org admins ask in words (AI), the super admin fills a structured filter (no AI). */
export function ReportsPage({ scope }: { scope: Scope }) {
  const { t } = useTranslation()
  const platform = scope === 'platform'
  // The ask/builder panel is remounted on reset so its inputs start clean.
  const [confirmed, setConfirmed] = useState<Report | null>(null)
  const [round, setRound] = useState(0)

  const reset = () => {
    setConfirmed(null)
    setRound((n) => n + 1)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{platform ? t('reports.platformTitle') : t('reports.title')}</h1>
        <p className="text-sm text-muted">{platform ? t('reports.platformSubtitle') : t('reports.subtitle')}</p>
      </header>

      {confirmed ? (
        <ConfirmedPanel key={confirmed.id} scope={scope} report={confirmed} onReset={reset} />
      ) : platform ? (
        <BuilderPanel key={round} onConfirmed={setConfirmed} />
      ) : (
        <AskPanel key={round} onConfirmed={setConfirmed} />
      )}

      <HistoryList scope={scope} />
    </div>
  )
}

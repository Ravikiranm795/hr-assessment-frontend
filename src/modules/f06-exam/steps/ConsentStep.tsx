import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Html } from '@/components/Html'
import { HelpPanel } from '../HelpPanel'
import { examApi } from '../examApi'
import { examErrorText } from '../errors'
import { useFocusOnMount } from '../Screens'
import type { ExamState } from '../types'

interface ConsentStepProps {
  state: ExamState
  onDone: () => void
  onBack: () => void
  onHelpResolved: () => void
}

export function ConsentStep({ state, onDone, onBack, onHelpResolved }: ConsentStepProps) {
  const { t } = useTranslation()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const consentDoc = state.consent_document

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await examApi.consent(consentDoc?.document_version_id ?? null)
      onDone()
    } catch (e) {
      setError(examErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
        {t('exam.consent.title')}
      </h1>

      <section
        aria-label={t('exam.consent.document')}
        className="max-h-80 overflow-y-auto rounded-(--radius) border border-border bg-surface p-5 leading-relaxed"
        tabIndex={0}
      >
        {consentDoc?.content_html ? <Html html={consentDoc.content_html} /> : <p>{t('exam.consent.noDocument')}</p>}
      </section>

      {state.camera_required && <p className="text-sm">{t('exam.consent.cameraNotice')}</p>}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{t('exam.consent.agree')}</span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onBack}>
            {t('exam.consent.back')}
          </Button>
          <Button size="lg" disabled={!agreed} loading={busy} onClick={() => void submit()}>
            {t('exam.consent.continue')}
          </Button>
        </div>
        <HelpPanel pending={state.help_request_pending} onResolved={onHelpResolved} />
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/core/api/errors'
import { examErrorText } from './errors'
import { ExamLayout } from './ExamLayout'
import type { ExamState } from './types'

/** Moves focus to the heading when a step appears, so keyboard and screen reader users start in the right place. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}

/** A link that cannot be used (expired, revoked, bound to another browser...) or a fatal failure. */
export function ExamErrorScreen({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  const requestId = error instanceof ApiError ? error.requestId : null
  return (
    <ExamLayout state={null}>
      <div role="alert" className="rounded-(--radius) border border-border bg-surface p-8">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t('exam.error.title')}
        </h1>
        <p className="mt-3 text-muted">{examErrorText(error)}</p>
        {requestId && (
          <p className="mt-4 text-xs text-muted">
            {t('exam.error.reference')} <span className="font-mono">{requestId}</span>
          </p>
        )}
      </div>
    </ExamLayout>
  )
}

/** Locked thank-you. The state is optional: reopening a submitted link has no session to load it from. */
export function ThankYouScreen({ state }: { state: ExamState | null }) {
  const { t } = useTranslation()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  return (
    <ExamLayout state={state}>
      <div className="rounded-(--radius) border border-border bg-surface p-8">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t('exam.thanks.title')}
        </h1>
        <p className="mt-3 text-muted">{t('exam.thanks.body')}</p>
        <p className="mt-3 text-muted">{t('exam.thanks.close')}</p>
      </div>
    </ExamLayout>
  )
}

export function DeviceUnsupportedScreen() {
  const { t } = useTranslation()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-center" role="alert">
      <div className="max-w-sm">
        <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
          {t('exam.device.title')}
        </h1>
        <p className="mt-3 text-muted">{t('exam.device.body')}</p>
      </div>
    </main>
  )
}

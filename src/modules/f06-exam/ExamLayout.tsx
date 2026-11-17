import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Html } from '@/components/Html'
import { Spinner } from '@/components/Spinner'
import { readHeader, type ExamState } from './types'

interface ExamLayoutProps {
  state: ExamState | null
  children: ReactNode
  /** Narrow centred column for the pre-exam steps; the exam itself uses the full width. */
  narrow?: boolean
}

/**
 * The calm exam frame: organization header, a single content area, organization footer and, only when the
 * server sends watermark text, the "Powered by" line. The server decides the watermark; null means none.
 */
export function ExamLayout({ state, children, narrow = true }: ExamLayoutProps) {
  const { t } = useTranslation()
  const header = state ? readHeader(state) : null
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <a
        href="#exam-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('exam.layout.skip')}
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          {header?.logoUrl && <img src={header.logoUrl} alt="" className="h-8 w-auto" />}
          <p className="font-semibold">{header?.companyName ?? t('app.name')}</p>
          {state?.role_title && <p className="text-sm text-muted">{state.role_title}</p>}
        </div>
      </header>
      <main id="exam-main" className={narrow ? 'mx-auto w-full max-w-2xl flex-1 px-6 py-10' : 'mx-auto w-full max-w-6xl flex-1 px-6 py-6'}>
        {children}
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl space-y-1 px-6 py-3 text-xs text-muted">
          {state?.footer_html && <Html html={state.footer_html} />}
          {state?.watermark && <p>{state.watermark}</p>}
        </div>
      </footer>
    </div>
  )
}

export function ExamLoading() {
  const { t } = useTranslation()
  return <Spinner label={t('exam.loading')} fullPage />
}

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface AuthLayoutProps {
  title: string
  body?: string
  children: ReactNode
}

/** Centered card used by every F1 screen. The vendor line is always shown here (spec F-03, API_GAPS). */
export function AuthLayout({ title, body, children }: AuthLayoutProps) {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-sm rounded-(--radius) border border-border bg-surface p-8 shadow-card">
        <p className="text-sm font-semibold text-primary">{t('app.name')}</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        {body && <p className="mt-2 text-sm text-muted">{body}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <p className="text-xs text-muted">{t('app.poweredBy')}</p>
    </main>
  )
}

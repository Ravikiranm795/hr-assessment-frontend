import type { ReactNode } from 'react'

interface StatePageProps {
  title: string
  body?: string
  /** Shown on error screens so support can find the request (spec 8.3). */
  requestId?: string | null
  action?: ReactNode
}

/** Full-area message used for not found, feature disabled and error screens. */
export function StatePage({ title, body, requestId, action }: StatePageProps) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {body && <p className="mt-3 text-muted">{body}</p>}
        {requestId && <p className="mt-3 font-mono text-xs text-muted">{requestId}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </main>
  )
}

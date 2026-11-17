import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCRIPT = 'https://accounts.google.com/gsi/client'

/**
 * Google sign-in (spec F-02). Renders nothing unless VITE_GOOGLE_CLIENT_ID is set, because the
 * backend only accepts Google when the organization enabled it and its client id is configured.
 */
export function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!CLIENT_ID || !host.current) return
    const target = host.current
    const render = () => {
      const google = (window as unknown as { google?: GoogleIdentity }).google
      if (!google) return
      google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => onToken(r.credential) })
      google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: 320, text: 'signin_with' })
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
    if (existing) {
      render()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = render
    document.head.appendChild(script)
  }, [onToken])

  if (!CLIENT_ID) return null
  return (
    <div className="mt-6">
      <p className="mb-3 text-center text-xs text-muted">{t('login.or')}</p>
      <div ref={host} className="flex justify-center" aria-label={t('login.google')} />
    </div>
  )
}

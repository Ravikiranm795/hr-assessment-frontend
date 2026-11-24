import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/core/auth/AuthProvider'

/**
 * Landing page after a successful single sign-on. The API already set the refresh cookie; the auth
 * provider restores the session from it exactly like a page reload, so this page only waits and moves on.
 */
export function SsoDonePage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'authenticated') navigate('/', { replace: true })
    else if (status === 'anonymous') navigate('/login?sso_error=failed', { replace: true })
  }, [status, navigate])

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Spinner label={t('ssoLogin.finishing')} />
    </main>
  )
}

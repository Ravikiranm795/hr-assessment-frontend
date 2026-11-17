import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buttonStyles } from '@/components/Button'
import { StatePage } from '@/components/StatePage'
import { useAuth } from '@/core/auth/AuthProvider'

// Placeholder until F3 (dashboard) replaces it. Super admins have no dashboard: they land on organizations.
export function Home() {
  const { t } = useTranslation()
  const { me, role } = useAuth()
  if (role === 'super_admin') return <Navigate to="/platform/orgs" replace />
  return <StatePage title={t('nav.dashboard')} body={me?.user.name} />
}

export function NotFound() {
  const { t } = useTranslation()
  return (
    <StatePage
      title={t('notFound.title')}
      body={t('notFound.body')}
      action={
        <Link to="/" className={buttonStyles({ variant: 'primary' })}>
          {t('notFound.home')}
        </Link>
      }
    />
  )
}

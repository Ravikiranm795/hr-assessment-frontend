import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/Spinner'
import { StatePage } from '@/components/StatePage'
import { useAuth } from './AuthProvider'
import type { FlagKey, Role } from './types'

/** Signed-in users only. Forced password change is honoured before anything else (spec 8.1). */
export function RequireAuth() {
  const { status, me } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (status === 'loading') return <Spinner fullPage label={t('session.restoring')} />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (me?.user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

interface RequireAccessProps {
  roles?: Role[]
  flag?: FlagKey
  children: ReactNode
}

/** Role first, then feature flag. Wrong role reads as not found; a disabled flag gets its own page. */
export function RequireAccess({ roles, flag, children }: RequireAccessProps) {
  const { role, hasFlag } = useAuth()
  const { t } = useTranslation()

  if (roles && (!role || !roles.includes(role))) {
    return <StatePage title={t('notFound.title')} body={t('notFound.body')} />
  }
  if (flag && !hasFlag(flag)) {
    return <StatePage title={t('featureDisabled.title')} body={t('featureDisabled.body')} />
  }
  return <>{children}</>
}

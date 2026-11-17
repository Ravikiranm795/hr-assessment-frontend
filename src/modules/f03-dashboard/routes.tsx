import { Navigate, type RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { useAuth } from '@/core/auth/AuthProvider'
import { DashboardPage } from './DashboardPage'
import { GadgetsSettingsPage } from './GadgetsSettingsPage'

/** `/` is the staff dashboard; the super admin lands on the platform dashboard instead. */
function DashboardHome() {
  const { role } = useAuth()
  if (role === 'super_admin') return <Navigate to="/platform/dashboard" replace />
  return (
    <RequireAccess roles={['org_admin', 'hr_user']} flag="dashboard">
      <DashboardPage />
    </RequireAccess>
  )
}

export const shellRoutes: RouteObject[] = [
  { path: '/', element: <DashboardHome /> },
  {
    path: '/platform/dashboard',
    element: (
      <RequireAccess roles={['super_admin']}>
        <DashboardPage platform />
      </RequireAccess>
    ),
  },
  {
    path: '/settings/dashboard',
    element: (
      <RequireAccess roles={['org_admin', 'hr_user']} flag="dashboard_gadgets">
        <GadgetsSettingsPage />
      </RequireAccess>
    ),
  },
]

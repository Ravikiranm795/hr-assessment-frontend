import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const ReportsPage = lazyNamed(() => import('./ReportsPage'), 'ReportsPage')

// Organization admins ask in words at /reports (AI chat); the super admin has no AI and uses a filter builder at /platform/reports.
export const shellRoutes: RouteObject[] = [
  {
    path: '/reports',
    element: (
      <RequireAccess roles={['org_admin']} flag="reports_chat">
        <ReportsPage scope="org" />
      </RequireAccess>
    ),
  },
  {
    path: '/platform/reports',
    element: (
      <RequireAccess roles={['super_admin']}>
        <ReportsPage scope="platform" />
      </RequireAccess>
    ),
  },
]

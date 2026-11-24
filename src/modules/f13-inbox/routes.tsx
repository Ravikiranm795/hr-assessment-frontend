import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const InboxPage = lazyNamed(() => import('./InboxPage'), 'InboxPage')

/** Help-request inbox (spec F13): HR sees their own roles, org admins see all (the backend decides). */
export const shellRoutes: RouteObject[] = [
  {
    path: '/help-requests',
    element: (
      <RequireAccess roles={['org_admin', 'hr_user']} flag="help_requests">
        <InboxPage />
      </RequireAccess>
    ),
  },
]

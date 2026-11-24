import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const AuditPage = lazyNamed(() => import('./AuditPage'), 'AuditPage')

// The same screen serves both scopes: organization admins at /audit, the super admin read-only at /platform/audit.
export const shellRoutes: RouteObject[] = [
  {
    path: '/audit',
    element: (
      <RequireAccess roles={['org_admin']} flag="audit_view">
        <AuditPage scope="org" />
      </RequireAccess>
    ),
  },
  {
    path: '/platform/audit',
    element: (
      <RequireAccess roles={['super_admin']}>
        <AuditPage scope="platform" />
      </RequireAccess>
    ),
  },
]

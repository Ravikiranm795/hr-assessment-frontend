import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { RoleDetailPage } from './RoleDetailPage'
import { RolesListPage } from './RolesListPage'

/** Open roles and invites (spec F5): staff only, behind the `roles` flag. */
export const shellRoutes: RouteObject[] = [
  {
    path: '/roles',
    element: (
      <RequireAccess roles={['org_admin', 'hr_user']} flag="roles">
        <RolesListPage />
      </RequireAccess>
    ),
  },
  {
    path: '/roles/:id',
    element: (
      <RequireAccess roles={['org_admin', 'hr_user']} flag="roles">
        <RoleDetailPage />
      </RequireAccess>
    ),
  },
]

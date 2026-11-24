import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const RoleDetailPage = lazyNamed(() => import('./RoleDetailPage'), 'RoleDetailPage')
const RolesListPage = lazyNamed(() => import('./RolesListPage'), 'RolesListPage')

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

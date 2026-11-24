import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const TeamPage = lazyNamed(() => import('./TeamPage'), 'TeamPage')

export const shellRoutes: RouteObject[] = [
  {
    path: '/team',
    element: (
      <RequireAccess roles={['org_admin']} flag="team">
        <TeamPage />
      </RequireAccess>
    ),
  },
]

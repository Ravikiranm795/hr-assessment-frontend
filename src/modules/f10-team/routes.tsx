import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { TeamPage } from './TeamPage'

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

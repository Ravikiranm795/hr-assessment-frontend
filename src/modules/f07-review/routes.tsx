import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const ReviewPage = lazyNamed(() => import('./ReviewPage'), 'ReviewPage')

export const shellRoutes: RouteObject[] = [
  {
    path: '/attempts/:id',
    element: (
      <RequireAccess roles={['org_admin', 'hr_user']} flag="review">
        <ReviewPage />
      </RequireAccess>
    ),
  },
]

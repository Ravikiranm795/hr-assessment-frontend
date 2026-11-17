import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { AssessmentsListPage } from './AssessmentsListPage'
import { BuilderPage } from './BuilderPage'

const guard = (page: ReactNode) => (
  <RequireAccess roles={['org_admin', 'hr_user']} flag="assessments">
    {page}
  </RequireAccess>
)

/** F4 Assessments: list and builder, inside the app shell. */
export const shellRoutes: RouteObject[] = [
  { path: '/assessments', element: guard(<AssessmentsListPage />) },
  { path: '/assessments/:id', element: guard(<BuilderPage />) },
  { path: '/assessments/:id/versions/:vid', element: guard(<BuilderPage />) },
]

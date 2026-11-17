import type { ReactNode } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { AdminsTab } from './AdminsTab'
import { BrandingPage } from './BrandingPage'
import { DefaultsPage } from './DefaultsPage'
import { FlagsTab } from './FlagsTab'
import { MisuseTab } from './MisuseTab'
import { OrgLayout } from './OrgLayout'
import { OrgsPage } from './OrgsPage'
import { OverviewTab } from './OverviewTab'
import { RolesTab } from './RolesTab'
import { UsagePage } from './UsagePage'
import { UsersTab } from './UsersTab'

const superAdmin = (page: ReactNode) => <RequireAccess roles={['super_admin']}>{page}</RequireAccess>

export const shellRoutes: RouteObject[] = [
  { path: '/platform/orgs', element: superAdmin(<OrgsPage />) },
  {
    path: '/platform/orgs/:id',
    element: superAdmin(<OrgLayout />),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <OverviewTab /> },
      { path: 'users', element: <UsersTab /> },
      { path: 'roles', element: <RolesTab /> },
      { path: 'admins', element: <AdminsTab /> },
      { path: 'flags', element: <FlagsTab /> },
      { path: 'misuse', element: <MisuseTab /> },
    ],
  },
  { path: '/platform/flags/defaults', element: superAdmin(<DefaultsPage />) },
  { path: '/platform/branding', element: superAdmin(<BrandingPage />) },
  { path: '/platform/usage', element: superAdmin(<UsagePage />) },
]

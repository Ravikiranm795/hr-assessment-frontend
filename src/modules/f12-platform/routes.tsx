import type { ReactNode } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { RequireAccess } from '@/core/auth/guards'
import { lazyNamed } from '@/app/lazyNamed'

const AdminsTab = lazyNamed(() => import('./orgTabs'), 'AdminsTab')
const FlagsTab = lazyNamed(() => import('./orgTabs'), 'FlagsTab')
const MisuseTab = lazyNamed(() => import('./orgTabs'), 'MisuseTab')
const OrgLayout = lazyNamed(() => import('./orgTabs'), 'OrgLayout')
const OverviewTab = lazyNamed(() => import('./orgTabs'), 'OverviewTab')
const RolesTab = lazyNamed(() => import('./orgTabs'), 'RolesTab')
const UsersTab = lazyNamed(() => import('./orgTabs'), 'UsersTab')
const BrandingPage = lazyNamed(() => import('./BrandingPage'), 'BrandingPage')
const DefaultsPage = lazyNamed(() => import('./DefaultsPage'), 'DefaultsPage')
const OrgsPage = lazyNamed(() => import('./OrgsPage'), 'OrgsPage')
const UsagePage = lazyNamed(() => import('./UsagePage'), 'UsagePage')

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

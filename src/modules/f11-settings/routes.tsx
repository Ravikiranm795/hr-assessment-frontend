import { Navigate, type RouteObject } from 'react-router-dom'
import type { ReactNode } from 'react'
import { RequireAccess } from '@/core/auth/guards'
import type { FlagKey } from '@/core/auth/types'
import { lazyNamed } from '@/app/lazyNamed'

const AiPage = lazyNamed(() => import('./AiPage'), 'AiPage')
const BrandingPage = lazyNamed(() => import('./BrandingPage'), 'BrandingPage')
const DocumentDetailPage = lazyNamed(() => import('./DocumentDetailPage'), 'DocumentDetailPage')
const DocumentsPage = lazyNamed(() => import('./DocumentsPage'), 'DocumentsPage')
const EmailPage = lazyNamed(() => import('./EmailPage'), 'EmailPage')
const InvitesPage = lazyNamed(() => import('./NumberSettingPage'), 'InvitesPage')
const RetentionPage = lazyNamed(() => import('./NumberSettingPage'), 'RetentionPage')
const ProfilePage = lazyNamed(() => import('./ProfilePage'), 'ProfilePage')
const SignInPage = lazyNamed(() => import('./SignInPage'), 'SignInPage')
const SecurityPage =lazyNamed(() => import('./SecurityPage'), 'SecurityPage')

const admin = (flag: FlagKey, page: ReactNode) => (
  <RequireAccess roles={['org_admin']} flag={flag}>
    {page}
  </RequireAccess>
)

// Submenus mirror the menu in f02-shell/nav.tsx. Dashboard gadgets live in the f03-dashboard module.
export const shellRoutes: RouteObject[] = [
  { path: '/settings', element: <Navigate to="/settings/profile" replace /> },
  { path: '/settings/profile', element: <RequireAccess roles={['org_admin', 'hr_user', 'engineer']}><ProfilePage /></RequireAccess> },
  { path: '/settings/security', element: admin('settings', <SecurityPage />) },
  { path: '/settings/retention', element: admin('settings', <RetentionPage />) },
  { path: '/settings/invites', element: admin('settings', <InvitesPage />) },
  { path: '/settings/email', element: admin('settings', <EmailPage />) },
  { path: '/settings/sign-in', element: admin('sso_signin', <SignInPage />) },
  { path: '/settings/ai', element: admin('ai_provider_setup', <AiPage />) },
  { path: '/settings/branding', element: admin('org_branding', <BrandingPage />) },
  { path: '/settings/documents', element: admin('policy_documents', <DocumentsPage />) },
  { path: '/settings/documents/:id', element: admin('policy_documents', <DocumentDetailPage />) },
]

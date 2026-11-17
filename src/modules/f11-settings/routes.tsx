import { Navigate, type RouteObject } from 'react-router-dom'
import type { ReactNode } from 'react'
import { RequireAccess } from '@/core/auth/guards'
import type { FlagKey } from '@/core/auth/types'
import { AiPage } from './AiPage'
import { BrandingPage } from './BrandingPage'
import { DocumentDetailPage } from './DocumentDetailPage'
import { DocumentsPage } from './DocumentsPage'
import { EmailPage } from './EmailPage'
import { InvitesPage, RetentionPage } from './NumberSettingPage'
import { ProfilePage } from './ProfilePage'
import { SecurityPage } from './SecurityPage'

const admin = (flag: FlagKey, page: ReactNode) => (
  <RequireAccess roles={['org_admin']} flag={flag}>
    {page}
  </RequireAccess>
)

// Submenus mirror the menu in f02-shell/nav.tsx. Dashboard gadgets live in the f03-dashboard module.
export const shellRoutes: RouteObject[] = [
  { path: '/settings', element: <Navigate to="/settings/profile" replace /> },
  { path: '/settings/profile', element: <RequireAccess roles={['org_admin', 'hr_user']}><ProfilePage /></RequireAccess> },
  { path: '/settings/security', element: admin('settings', <SecurityPage />) },
  { path: '/settings/retention', element: admin('settings', <RetentionPage />) },
  { path: '/settings/invites', element: admin('settings', <InvitesPage />) },
  { path: '/settings/email', element: admin('settings', <EmailPage />) },
  { path: '/settings/ai', element: admin('ai_provider_setup', <AiPage />) },
  { path: '/settings/branding', element: admin('org_branding', <BrandingPage />) },
  { path: '/settings/documents', element: admin('policy_documents', <DocumentsPage />) },
  { path: '/settings/documents/:id', element: admin('policy_documents', <DocumentDetailPage />) },
]

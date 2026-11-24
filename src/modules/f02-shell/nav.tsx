import {
  Briefcase,
  Building2,
  ClipboardList,
  Flag,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  ScrollText,
  Settings,
  Users,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import type { FlagKey, Role } from '@/core/auth/types'

export interface NavLeaf {
  /** i18n key for the label. */
  label: string
  to: string
  roles: Role[]
  flag?: FlagKey
}

export interface NavItem extends NavLeaf {
  icon: LucideIcon
  /** Submenus (spec F-07). A section opens the submenu panel and collapses the main menu to a rail. */
  children?: NavLeaf[]
}

const STAFF: Role[] = ['org_admin', 'hr_user']
const ADMIN: Role[] = ['org_admin']
const WITH_ENGINEER: Role[] = ['org_admin', 'hr_user', 'engineer']

// Menu map from spec F2. A tab shows only if the role allows it AND the feature flag is on (F-06).
export const NAV: NavItem[] = [
  { label: 'nav.dashboard', to: '/', icon: LayoutDashboard, roles: STAFF, flag: 'dashboard' },
  { label: 'nav.assessments', to: '/assessments', icon: ClipboardList, roles: WITH_ENGINEER, flag: 'assessments' },
  { label: 'nav.roles', to: '/roles', icon: Briefcase, roles: STAFF, flag: 'roles' },
  { label: 'nav.helpRequests', to: '/help-requests', icon: LifeBuoy, roles: STAFF, flag: 'help_requests' },
  { label: 'nav.reports', to: '/reports', icon: FileText, roles: ADMIN, flag: 'reports_chat' },
  { label: 'nav.audit', to: '/audit', icon: ScrollText, roles: ADMIN, flag: 'audit_view' },
  { label: 'nav.team', to: '/team', icon: Users, roles: ADMIN, flag: 'team' },
  {
    label: 'nav.settings',
    to: '/settings',
    icon: Settings,
    roles: WITH_ENGINEER,
    children: [
      { label: 'settingsMenu.profile', to: '/settings/profile', roles: WITH_ENGINEER },
      { label: 'settingsMenu.security', to: '/settings/security', roles: ADMIN, flag: 'settings' },
      { label: 'settingsMenu.signIn', to: '/settings/sign-in', roles: ADMIN, flag: 'sso_signin' },
      { label: 'settingsMenu.retention', to: '/settings/retention', roles: ADMIN, flag: 'settings' },
      { label: 'settingsMenu.invites', to: '/settings/invites', roles: ADMIN, flag: 'settings' },
      { label: 'settingsMenu.email', to: '/settings/email', roles: ADMIN, flag: 'settings' },
      { label: 'settingsMenu.ai', to: '/settings/ai', roles: ADMIN, flag: 'ai_provider_setup' },
      { label: 'settingsMenu.branding', to: '/settings/branding', roles: ADMIN, flag: 'org_branding' },
      { label: 'settingsMenu.documents', to: '/settings/documents', roles: ADMIN, flag: 'policy_documents' },
      { label: 'settingsMenu.dashboard', to: '/settings/dashboard', roles: STAFF, flag: 'dashboard_gadgets' },
    ],
  },
  { label: 'nav.dashboard', to: '/platform/dashboard', icon: LayoutDashboard, roles: ['super_admin'] },
  { label: 'nav.organizations', to: '/platform/orgs', icon: Building2, roles: ['super_admin'] },
  { label: 'nav.featureFlags', to: '/platform/flags/defaults', icon: Flag, roles: ['super_admin'] },
  { label: 'nav.platformBranding', to: '/platform/branding', icon: Palette, roles: ['super_admin'] },
  { label: 'nav.platformAudit', to: '/platform/audit', icon: ScrollText, roles: ['super_admin'] },
  { label: 'nav.usage', to: '/platform/usage', icon: Gauge, roles: ['super_admin'] },
  { label: 'nav.platformReports', to: '/platform/reports', icon: FileText, roles: ['super_admin'] },
]

type Visible = (leaf: NavLeaf) => boolean

export function makeVisible(role: Role | null, hasFlag: (f: FlagKey) => boolean): Visible {
  return (leaf) => !!role && leaf.roles.includes(role) && (!leaf.flag || hasFlag(leaf.flag))
}

export interface ResolvedItem extends NavItem {
  /** Visible submenus only; a section with one visible submenu opens it directly (`href`). */
  visibleChildren: NavLeaf[]
  href: string
}

/** Filter the menu by role and flags and decide where each entry links. */
export function resolveNav(visible: Visible): ResolvedItem[] {
  const out: ResolvedItem[] = []
  for (const item of NAV) {
    if (!visible(item)) continue
    if (!item.children) {
      out.push({ ...item, visibleChildren: [], href: item.to })
      continue
    }
    const visibleChildren = item.children.filter(visible)
    if (visibleChildren.length === 0) continue
    out.push({ ...item, visibleChildren, href: visibleChildren[0].to })
  }
  return out
}

/** The section whose URL prefix contains the path, if it has submenus. */
export function activeSection(items: ResolvedItem[], pathname: string) {
  return items.find((i) => i.visibleChildren.length > 0 && (pathname === i.to || pathname.startsWith(`${i.to}/`)))
}

/** The page a role lands on (main page). */
export function homeFor(role: Role | null) {
  if (role === 'super_admin') return '/platform/dashboard'
  return role === 'engineer' ? '/assessments' : '/'
}

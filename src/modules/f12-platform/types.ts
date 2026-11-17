/** Shapes read from the live /api/v1/platform/* endpoints (2026-11-17). */

export interface Org {
  id: string
  name: string
  slug: string
  status: 'active' | 'disabled' | string
  retention_days: number
  locale: string
  timezone: string
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface OrgUser {
  id: string
  org_id: string
  name: string
  email: string
  role: 'org_admin' | 'hr_user' | string
  status: 'active' | 'inactive' | string
  last_login_at: string | null
  is_locked: boolean
  must_change_password: boolean
  created_at: string
}

export interface OrgRole {
  id: string
  title: string
  department: string | null
  status: string
  owner_id: string
  owner_name: string
  owner_inactive: boolean
  created_at: string
}

export interface Overview {
  users: { total: number; active: number; inactive: number; org_admins: number; hr_users: number }
  open_roles: number
  roles_total: number
  invites: { total: number; invited: number; started: number; submitted: number; expired: number; revoked: number }
  attempts: { total: number; submitted: number }
  ai_usage: { calls_this_month: number }
}

export interface CatalogFlag {
  key: string
  description: string
  default_enabled: boolean
  visible_to_org: boolean
  depends_on: string[]
}

export interface OrgFlagState {
  enabled: boolean
  effective: boolean
  visible_to_org: boolean
}

export interface MisuseFlag {
  id: string
  org_id: string
  user_id: string | null
  raised_by: string
  comment: string
  status: 'open' | 'cleared' | string
  raised_at: string
  cleared_by: string | null
  closing_note: string | null
  cleared_at: string | null
}

export interface UsageItem {
  org_id: string
  org_name: string
  calls: number
  tokens_in: number
  tokens_out: number
  by_feature: Record<string, number>
}

export interface PlatformBranding {
  scope: string
  primary_color: string
  accent_color: string
  background_style: string
  font_key: string
  is_default: boolean
  updated_at: string | null
}

export interface TempPassword {
  name: string
  password: string
}

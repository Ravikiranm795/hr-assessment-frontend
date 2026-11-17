import type { components } from '@/api-types/schema'

export type SessionOut = components['schemas']['app__modules__m01_auth__schemas__SessionOut']
export type UserOut = components['schemas']['app__modules__m01_auth__schemas__UserOut']
export type MeOut = components['schemas']['MeOut']
export type Role = UserOut['role']

/** Feature flag keys (spec Appendix A). */
export type FlagKey =
  | 'dashboard'
  | 'dashboard_gadgets'
  | 'assessments'
  | 'ai_question_builder'
  | 'ai_scoring'
  | 'question_bank'
  | 'roles'
  | 'invites'
  | 'csv_bulk_invite'
  | 'email_sending'
  | 'help_requests'
  | 'camera_proctoring'
  | 'review'
  | 'reports_chat'
  | 'audit_view'
  | 'audit_export'
  | 'team'
  | 'settings'
  | 'org_branding'
  | 'policy_documents'
  | 'ai_provider_setup'
  | 'watermark'

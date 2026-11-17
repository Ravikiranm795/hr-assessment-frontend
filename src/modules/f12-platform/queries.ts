import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { api } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import type { Org } from './types'

export const platformKeys = {
  all: ['platform'] as const,
  orgs: ['platform', 'orgs'] as const,
  org: (id: string) => ['platform', 'org', id] as const,
}

/** One organization record; 4xx is not retried so the not-found page shows at once. */
export function useOrg(id: string) {
  return useQuery({
    queryKey: platformKeys.org(id),
    queryFn: () => api.get<Org>(`/api/v1/platform/orgs/${id}`),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

/** The organization record handed to every tab through the router outlet. */
export function useOrgContext() {
  return useOutletContext<Org>()
}

/** Platform admin may change every catalog flag; this order follows the spec list. */
export const FLAG_KEYS = [
  'dashboard',
  'dashboard_gadgets',
  'assessments',
  'ai_question_builder',
  'ai_scoring',
  'question_bank',
  'roles',
  'invites',
  'csv_bulk_invite',
  'email_sending',
  'help_requests',
  'camera_proctoring',
  'review',
  'reports_chat',
  'audit_view',
  'audit_export',
  'team',
  'settings',
  'org_branding',
  'policy_documents',
  'ai_provider_setup',
  'watermark',
] as const

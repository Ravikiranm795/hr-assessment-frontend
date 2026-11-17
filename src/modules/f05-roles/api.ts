import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import type { AssessmentItem, HelpRequest, InviteListItem, Page, RoleDetail, RoleRow, TeamUser } from './types'

export interface RoleFilters {
  q: string
  status: string
  department: string
  owner_id: string
  mine: boolean
}

export const roleKeys = {
  all: ['roles'] as const,
  list: (filters: RoleFilters, page: number, pageSize: number, sort?: string) =>
    ['roles', 'list', filters, page, pageSize, sort] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
  invites: (id: string) => ['roles', 'invites', id] as const,
  helpRequests: ['roles', 'help-requests'] as const,
}

export function useRoles(filters: RoleFilters, page: number, pageSize: number, sort?: string) {
  return useQuery({
    queryKey: roleKeys.list(filters, page, pageSize, sort),
    queryFn: () =>
      api.get<Page<RoleRow>>('/api/v1/roles', {
        q: filters.q,
        status: filters.status,
        department: filters.department,
        owner_id: filters.owner_id,
        mine: filters.mine || undefined,
        page,
        page_size: pageSize,
        sort,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useRole(id: string) {
  return useQuery({ queryKey: roleKeys.detail(id), queryFn: () => api.get<RoleDetail>(`/api/v1/roles/${id}`) })
}

export function useInvites(roleId: string, page: number, pageSize: number, status: string, sort?: string) {
  return useQuery({
    queryKey: [...roleKeys.invites(roleId), page, pageSize, status, sort],
    queryFn: () =>
      api.get<Page<InviteListItem>>(`/api/v1/roles/${roleId}/invites`, { page, page_size: pageSize, status, sort }),
    placeholderData: keepPreviousData,
  })
}

/** Open requests across the caller's roles; the list has no role filter, so the page narrows it. */
export function useOpenHelpRequests(enabled: boolean) {
  return useQuery({
    queryKey: roleKeys.helpRequests,
    enabled,
    queryFn: () => api.get<Page<HelpRequest>>('/api/v1/help-requests', { status: 'open', page_size: 100 }),
  })
}

/** `linkable` returns active assessments that have a published version. */
export function useLinkableAssessments(q: string) {
  return useQuery({
    queryKey: ['roles', 'linkable', q],
    queryFn: () => api.get<Page<AssessmentItem>>('/api/v1/assessments', { linkable: true, q, page_size: 50 }),
    placeholderData: keepPreviousData,
  })
}

/** Org admin only (HR users get 403): used for the owner filter and reassign. */
export function useTeamUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['roles', 'team-users'],
    enabled,
    staleTime: 60_000,
    queryFn: () => api.get<Page<TeamUser>>('/api/v1/team/users', { status: 'active', page_size: 100 }),
  })
}

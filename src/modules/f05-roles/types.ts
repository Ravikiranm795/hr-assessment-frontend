import type { components } from '@/api-types/schema'

type S = components['schemas']

export type RoleRow = S['RoleOut']
export type RoleDetail = S['RoleDetail']
export type InviteRow = S['InviteRow']
export type InviteRowLimited = S['InviteRowLimited']
export type InviteDetail = S['InviteDetail']
export type InviteCreated = S['InviteCreated']
export type BulkResult = S['BulkResult']
export type HelpRequest = S['HelpRequestOut']
export type AssessmentItem = S['AssessmentListItem']
export type TeamUser = S['app__modules__m03_team__schemas__UserOut']

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/** The backend returns the full row for the owner and an admin, and the limited row for another HR user. */
export type InviteListItem = InviteRow | InviteRowLimited

export function isFullInvite(row: InviteListItem): row is InviteRow {
  return 'expires_at' in row
}

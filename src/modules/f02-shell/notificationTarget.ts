import type { components } from '@/api-types/schema'

export type Notification = components['schemas']['NotificationOut']

/** Where a notification leads. Unknown entity types fall back to the main page. */
export function notificationTarget(n: Notification): string {
  const roleId = typeof n.payload.role_id === 'string' ? n.payload.role_id : null
  switch (n.entity_type) {
    case 'attempt':
      return n.entity_id ? `/attempts/${n.entity_id}` : '/'
    case 'invite':
      return roleId ? `/roles/${roleId}` : '/roles'
    case 'role':
      return n.entity_id ? `/roles/${n.entity_id}` : '/roles'
    case 'help_request':
      return '/help-requests'
    default:
      return '/'
  }
}

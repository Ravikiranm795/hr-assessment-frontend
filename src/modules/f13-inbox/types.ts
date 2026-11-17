import type { components } from '@/api-types/schema'

export type HelpRequest = components['schemas']['HelpRequestOut']

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

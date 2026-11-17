import type { components } from '@/api-types/schema'

export type TeamUser = components['schemas']['app__modules__m03_team__schemas__UserOut']
export interface TeamPage {
  items: TeamUser[]
  total: number
  page: number
  page_size: number
}
export interface TempPassword {
  name: string
  password: string
}

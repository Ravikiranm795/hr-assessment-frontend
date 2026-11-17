export type Size = 'sm' | 'md' | 'lg'

export interface LayoutItem {
  key: string
  size: Size
  enabled: boolean
}
export interface Layout {
  items: LayoutItem[]
  is_default: boolean
}
export interface CatalogItem {
  key: string
  title_key: string
  default_enabled: boolean
  default_order: number
}

/** Gadget data arrives as `{ key, data }`; each renderer narrows `data` itself. */
export type GadgetData = Record<string, unknown>

/** Fixed-size scrollable cards (spec F-18). */
export const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-56 col-span-1',
  md: 'h-72 col-span-1',
  lg: 'h-72 col-span-1 xl:col-span-2',
}

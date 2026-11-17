import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { cn } from '@/core/utils'

export interface MenuItem {
  key: string
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

interface MenuProps {
  /** The trigger element (a button). */
  trigger: ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
}

/** Module-local dropdown menu (promotion candidate): keyboard operable via Radix. */
export function Menu({ trigger, items, align = 'end' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-48 rounded-(--radius) border border-border bg-surface p-1 shadow-card"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.key}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                'cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-bg',
                item.danger && 'text-error',
              )}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

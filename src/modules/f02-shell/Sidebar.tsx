import { Menu } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'
import { homeFor, type NavLeaf, type ResolvedItem } from './nav'
import type { Role } from '@/core/auth/types'

interface SidebarProps {
  items: ResolvedItem[]
  role: Role | null
  /** Rail mode: icons only with tooltips, used while a submenu panel is open (F-07). */
  rail: boolean
  section: ResolvedItem | undefined
}

const linkBase = 'flex items-center gap-3 rounded-(--radius) text-sm font-medium transition-colors'

export function Sidebar({ items, role, rail, section }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <aside className={cn('flex shrink-0 flex-col border-r border-border bg-surface', rail ? 'w-16' : 'w-60')}>
      {rail && (
        // The hamburger closes the submenu panel and returns to the main page (spec F-07).
        <button
          type="button"
          className="m-3 flex h-10 items-center justify-center rounded-(--radius) text-muted hover:bg-bg hover:text-text"
          aria-label={t('nav.expand')}
          title={t('nav.expand')}
          onClick={() => navigate(homeFor(role))}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      )}
      <nav aria-label={t('nav.main')} className={cn('flex flex-col gap-1 p-3', rail && 'pt-0')}>
        {items.map((item) => {
          const active = item === section || (!item.visibleChildren.length && matches(item, pathname))
          return (
            <NavLink
              key={item.to}
              to={item.href}
              title={rail ? t(item.label) : undefined}
              aria-label={rail ? t(item.label) : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                linkBase,
                rail ? 'h-10 justify-center' : 'px-3 py-2.5',
                active ? 'bg-primary text-primary-contrast' : 'text-text hover:bg-bg',
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden />
              {!rail && <span>{t(item.label)}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

function matches(item: NavLeaf, pathname: string) {
  return item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

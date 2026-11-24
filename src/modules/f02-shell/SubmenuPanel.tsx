import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'
import type { ResolvedItem } from './nav'

/** Second panel opened by a section with submenus; details render to its right (spec F-07). */
export function SubmenuPanel({ section }: { section: ResolvedItem }) {
  const { t } = useTranslation()
  return (
    <nav className="side-scope w-56 shrink-0 border-r border-border p-4" aria-label={t('nav.submenu')}>
      <h2 className="mb-3 px-3 text-xs font-semibold tracking-wide text-muted uppercase">{t(section.label)}</h2>
      <ul className="flex flex-col gap-1">
        {section.visibleChildren.map((child) => (
          <li key={child.to}>
            <NavLink
              to={child.to}
              className={({ isActive }) =>
                cn(
                  'block rounded-(--radius) px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-primary text-primary-contrast' : 'text-text hover:bg-bg',
                )
              }
            >
              {t(child.label)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Suspense, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RouteFallback } from '@/app/RouteFallback'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { applyBranding, type BrandingOut } from '@/core/branding'
import { resetTheme } from '@/core/theme'
import { NotificationBell } from './NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { Sidebar } from './Sidebar'
import { SubmenuPanel } from './SubmenuPanel'
import { activeSection, makeVisible, resolveNav } from './nav'
import { useIdleTimeout } from './useIdleTimeout'

/** Signed-in layout: sidebar (or icon rail + submenu panel), top bar, organization theme, idle guard. */
export function AppShell() {
  const { t } = useTranslation()
  const { me, role, hasFlag, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const items = useMemo(() => resolveNav(makeVisible(role, hasFlag)), [role, hasFlag])
  const section = activeSection(items, pathname)

  // Theme comes from the endpoint /auth/me names (platform for super admins, org for the rest).
  const branding = useQuery({
    // The org id is part of the key so one organization's branding is never served to another user.
    queryKey: ['branding', me?.branding.endpoint, me?.organization?.id ?? null],
    queryFn: () => api.get<BrandingOut>(me!.branding.endpoint),
    enabled: !!me,
    staleTime: 5 * 60_000,
  })
  useEffect(() => {
    if (!branding.data) return
    resetTheme() // drop any previous organization's tokens and favicon first
    applyBranding(branding.data)
  }, [branding.data, me?.organization?.id])
  useEffect(() => resetTheme, []) // back to the starter theme and default favicon when the shell goes away (sign out)

  const leave = useCallback(() => {
    void signOut().finally(() => navigate('/login', { replace: true }))
  }, [signOut, navigate])
  const idle = useIdleTimeout(me?.session_timeout_minutes ?? 30, leave)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={items} role={role} rail={!!section} section={section} />
      {section && <SubmenuPanel section={section} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6 top-scope">
          <div className="flex items-center gap-3">
            {branding.data?.logo_url && <img src={branding.data.logo_url} alt="" className="h-7 w-auto" />}
            <span className="font-semibold">{me?.organization?.name ?? t('app.name')}</span>
          </div>
          <div className="flex items-center gap-2">
            {role !== 'engineer' && <NotificationBell />}
            <ProfileMenu />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <ConfirmDialog
        open={idle.secondsLeft !== null}
        onOpenChange={(open) => {
          if (!open) idle.stay()
        }}
        title={t('session.idle.title')}
        body={`${t('session.idle.body')} (${idle.secondsLeft})`}
        confirmLabel={t('session.idle.stay')}
        onConfirm={() => {
          idle.stay()
          void api.get('/api/v1/auth/me') // counts as server-side activity
        }}
      />
    </div>
  )
}

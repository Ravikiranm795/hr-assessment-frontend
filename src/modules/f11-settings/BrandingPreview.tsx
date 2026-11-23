import { Briefcase, ClipboardList, FileText, LayoutDashboard, LifeBuoy, Settings, UserCircle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { navTokens, pageTokens } from '@/core/branding'

export interface PreviewTheme {
  primary: string
  accent: string
  primaryContrast: string
  accentContrast: string
  background: string
  fontFamily: string
  navTheme: string
  pageTheme: string
  logoUrl: string | null
  orgName: string
}

const NAV = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'assessments', icon: ClipboardList },
  { key: 'roles', icon: Briefcase },
  { key: 'help', icon: LifeBuoy },
  { key: 'reports', icon: FileText },
  { key: 'settings', icon: Settings },
] as const
const BARS = [40, 40, 80]

/** Miniature of the signed-in home page, drawn with the unsaved theme so every change shows at once. */
export function BrandingPreview({ theme }: { theme: PreviewTheme }) {
  const { t } = useTranslation()
  const style = {
    ...pageTokens(theme.pageTheme),
    '--color-primary': theme.primary,
    '--color-primary-contrast': theme.primaryContrast,
    '--color-accent': theme.accent,
    '--color-accent-contrast': theme.accentContrast,
    '--color-bg': theme.background,
    '--font-sans': theme.fontFamily,
    fontFamily: theme.fontFamily,
    ...navTokens(theme.navTheme),
  } as CSSProperties

  return (
    <div style={style} className="flex h-[26rem] overflow-hidden rounded-(--radius) border border-border bg-bg text-text" aria-label={t('settings.branding.preview')} role="img">
      <aside className="nav-scope flex w-36 shrink-0 flex-col gap-1 border-r border-border p-2">
        {NAV.map(({ key, icon: Icon }, i) => (
          <span
            key={key}
            className={`flex items-center gap-2 rounded-(--radius) px-2 py-1.5 text-[11px] font-medium ${i === 0 ? 'bg-primary text-primary-contrast' : ''}`}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {t(`settings.branding.pv.nav.${key}`)}
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="nav-scope flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[11px]">
          <span className="flex items-center gap-2 font-semibold">
            {theme.logoUrl && <img src={theme.logoUrl} alt="" className="h-4 w-auto" />}
            {theme.orgName}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <UserCircle className="size-4" aria-hidden />
            {t('settings.branding.pv.user')}
          </span>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold">{t('settings.branding.pv.title')}</p>
              <p className="text-[10px] text-muted">{t('settings.branding.pv.welcome')}</p>
            </div>
            <span className="rounded-(--radius) bg-accent px-2 py-1 text-[10px] font-medium text-accent-contrast">{t('settings.branding.previewAccent')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Card title={t('settings.branding.pv.glance')}>
              <div className="grid grid-cols-2 gap-1">
                {[0, 0, 11, 6].map((n, i) => (
                  <span key={i} className="rounded border border-border px-1.5 py-1 text-xs font-semibold">
                    {n}
                  </span>
                ))}
              </div>
            </Card>
            <Card title={t('settings.branding.pv.attention')}>
              {[6, 3, 1].map((n) => (
                <p key={n} className="flex items-center justify-between border-b border-border py-0.5 text-[10px] last:border-0">
                  <span className="h-1.5 w-14 rounded bg-border" />
                  <span className="rounded-full bg-accent px-1.5 text-accent-contrast">{n}</span>
                </p>
              ))}
            </Card>
            <Card title={t('settings.branding.pv.week')}>
              <div className="flex h-12 items-end gap-2">
                {BARS.map((h, i) => (
                  <span key={i} className="flex-1 rounded-t bg-primary" style={{ height: `${h}%` }} />
                ))}
              </div>
            </Card>
            <Card title={t('settings.branding.pv.score')}>
              {[60, 72, 58].map((p) => (
                <span key={p} className="mb-1 block h-1.5 rounded bg-border">
                  <span className="block h-full rounded bg-primary" style={{ width: `${p}%` }} />
                </span>
              ))}
              <span className="mt-1 inline-block rounded-(--radius) bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-contrast">{t('settings.branding.previewButton')}</span>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius) border border-border bg-surface p-2">
      <p className="mb-1.5 text-[10px] font-semibold">{title}</p>
      {children}
    </div>
  )
}

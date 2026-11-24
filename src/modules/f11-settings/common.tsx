import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { contrastRatio, isHex, normalizeHex, readableText } from '@/core/branding'

export interface ColorCheck {
  ratio: number
  minimum: number
  passes: boolean
}

/**
 * One colour input used across the Branding page: native picker + typed hex code + swatch, kept in sync.
 * `value` holds what was typed ('' = unset when `optional`). Invalid text is passed up as typed so the page can
 * block saving; it is normalised to uppercase #RRGGBB on blur. With `against` it shows a live WCAG contrast check
 * (ratio, pass/fail, "use suggested"); `check` shows a server-provided result instead.
 */
export function ColorField({ id, label, value, onChange, optional, against, againstLabel, check }: { id: string; label: string; value: string; onChange: (v: string) => void; optional?: boolean; against?: string; againstLabel?: string; check?: ColorCheck }) {
  const { t } = useTranslation()
  const valid = isHex(value)
  const invalid = value !== '' ? !valid : !optional
  const type = (raw: string) => {
    const v = raw.trim().toUpperCase()
    onChange(/^[0-9A-F]+$/.test(v) ? `#${v}` : v)
  }
  const live: ColorCheck | undefined = check ?? (valid && isHex(against) ? (() => { const r = contrastRatio(value, against); return { ratio: Math.round(r * 10) / 10, minimum: 4.5, passes: r >= 4.5 } })() : undefined)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input type="color" aria-label={t('settings.branding.picker', { label })} className="h-10 w-12 cursor-pointer rounded border border-border bg-surface" value={valid ? value.toLowerCase() : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <span className="size-6 rounded border border-border" style={{ background: valid ? value : 'transparent' }} aria-hidden />
        <input
          id={id}
          className={`h-10 w-28 rounded-(--radius) border bg-surface px-3 font-mono text-sm ${invalid ? 'border-error' : 'border-border'}`}
          value={value}
          maxLength={7}
          placeholder={optional ? t('settings.branding.notSet') : '#RRGGBB'}
          onChange={(e) => type(e.target.value)}
          onBlur={() => { const n = normalizeHex(value); if (n && n !== value) onChange(n) }}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : undefined}
        />
        {live && (
          <Badge tone={live.passes ? 'success' : 'error'}>
            {live.passes ? t('settings.branding.contrastPass', { ratio: live.ratio }) : t('settings.branding.contrastFail', { ratio: live.ratio, min: live.minimum })}
          </Badge>
        )}
        {against && isHex(against) && (
          <Button size="sm" variant="outline" onClick={() => onChange(readableText(against))}>{t('settings.branding.useSuggested')}</Button>
        )}
      </div>
      {againstLabel && valid && isHex(against) && <p className="text-xs text-muted">{t('settings.branding.contrastOn', { on: againstLabel })}</p>}
      {invalid && value !== '' && <p id={`${id}-err`} role="alert" className="text-xs text-error">{t('settings.branding.invalidHex')}</p>}
      {invalid && value === '' && <p id={`${id}-err`} className="text-xs text-error">{t('settings.branding.invalidHex')}</p>}
    </div>
  )
}

/** Page frame shared by every settings screen: title, subtitle, loading and error states. */
export function SettingsFrame({
  title,
  subtitle,
  query,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  wide?: boolean
  query?: Pick<UseQueryResult, 'isPending' | 'isError' | 'error' | 'refetch'>
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={`mx-auto space-y-6 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </header>
      {query?.isPending && <Spinner label={t('common.loading')} className="py-10" />}
      {query?.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {(!query || (!query.isPending && !query.isError)) && children}
    </div>
  )
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
      {title && <h2 className="text-sm font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  )
}

export function useSetting<T>(path: string) {
  return useQuery({ queryKey: ['settings', path], queryFn: () => api.get<T>(path) })
}

/** Save a settings form with PATCH or PUT; refreshes the cached GET and confirms with a toast. */
export function useSaveSetting<TBody, TOut = unknown>(path: string, method: 'patch' | 'put' = 'patch', onSaved?: (out: TOut) => void) {
  const { t } = useTranslation()
  const toast = useToast()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: TBody) => (method === 'patch' ? api.patch<TOut>(path, body) : api.put<TOut>(path, body)),
    onSuccess: (out) => {
      toast.success(t('settings.saved'))
      void client.invalidateQueries({ queryKey: ['settings', path] })
      onSaved?.(out)
    },
  })
}

export function Select({ id, label, value, onChange, children, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select id={id} disabled={disabled} className="h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  )
}

export function Check({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 size-4 accent-(--color-primary)" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  )
}

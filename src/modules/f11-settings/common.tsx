import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'

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

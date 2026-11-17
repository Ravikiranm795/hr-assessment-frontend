import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { api, requestFile, saveBlob } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { basePath, filterParams, type ColumnCatalog, type Filters, type Scope } from './types'

interface Props {
  scope: Scope
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: Filters
  /** Allow the export button for audit_export only; the page decides. */
}

/** Export the current filters as CSV (50,000 rows max) or PDF (2,000 rows max). The export is itself audited. */
export function ExportDialog({ scope, open, onOpenChange, filters }: Props) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const catalog = useQuery({ queryKey: ['audit', scope, 'columns'], queryFn: () => api.get<ColumnCatalog>(`${basePath(scope)}/columns`), enabled: open })
  const columns = catalog.data?.items ?? []
  // Default selection comes from the backend's `default` flags until the user changes it.
  const selected = picked ?? new Set(columns.filter((c) => c.default).map((c) => c.key))
  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setPicked(next)
  }

  const run = useMutation({
    mutationFn: async () => {
      const f = filterParams(filters)
      const { blob, filename } = await requestFile(`${basePath(scope)}/export`, {
        method: 'POST',
        body: { format, columns: [...selected], filters: { ...f, action: f.action ? [f.action] : undefined } },
      })
      saveBlob(blob, filename ?? `audit-log.${format}`)
    },
    onSuccess: () => {
      toast.success(t('audit.export.done'))
      onOpenChange(false)
    },
    onError: (e) => {
      const tooMany = e instanceof ApiError && e.fieldErrors.some((f) => f.code === 'too_many_rows')
      setError(tooMany ? t('audit.export.tooMany', { max: (e as ApiError).details.max_rows ?? (format === 'csv' ? 50000 : 2000) }) : errorText(e))
    },
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('audit.export.title')} description={t('audit.export.body')}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); run.mutate() }}>
        {error && <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t('audit.export.format')}</legend>
          {(['csv', 'pdf'] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input type="radio" name="export-format" checked={format === f} onChange={() => setFormat(f)} className="accent-(--color-primary)" />
              {t(`audit.export.${f}`)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('audit.export.columns')}</legend>
          <div className="grid grid-cols-2 gap-1">
            {columns.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} className="accent-(--color-primary)" />
                {i18n.exists(c.label_key) ? t(c.label_key) : c.key}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="submit" loading={run.isPending} disabled={selected.size === 0}>{t('audit.export.submit')}</Button>
        </div>
      </form>
    </Modal>
  )
}

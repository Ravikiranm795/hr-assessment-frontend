import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { cn } from '@/core/utils'
import { Card } from './common'
import { FLAG_KEYS } from './queries'
import type { CatalogFlag } from './types'

interface Props {
  catalog: CatalogFlag[]
  /** Stored value per flag key. */
  stored: Record<string, boolean>
  /** Value after dependencies; only known for a real organization. */
  effective?: Record<string, boolean>
  saving: boolean
  onSave: (changes: Record<string, boolean>, reason: string) => Promise<unknown>
}

/** Toggle grid shared by an organization's flags and the defaults for new organizations. Changes are staged, then saved once with an optional audit reason. */
export function FlagGrid({ catalog, stored, effective, saving, onSave }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState('')

  const known = new Map(catalog.map((f) => [f.key, f]))
  const order = [...FLAG_KEYS.filter((k) => known.has(k)), ...catalog.map((f) => f.key).filter((k) => !FLAG_KEYS.includes(k as (typeof FLAG_KEYS)[number]))]
  const value = (key: string) => draft[key] ?? stored[key] ?? false
  const changes = Object.fromEntries(Object.entries(draft).filter(([key, v]) => v !== stored[key]))
  const count = Object.keys(changes).length

  const toggle = (key: string, next: boolean) =>
    setDraft((d) => {
      const copy = { ...d }
      if (next === stored[key]) delete copy[key]
      else copy[key] = next
      return copy
    })

  return (
    <div className="space-y-4">
      <Card>
        <ul className="divide-y divide-border">
          {order.map((key) => {
            const flag = known.get(key)!
            const on = value(key)
            const changed = key in changes
            const blocked = effective !== undefined && stored[key] && effective[key] === false
            const label = t(`platform.flags.keys.${key}.label`, { defaultValue: key })
            return (
              <li key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <label htmlFor={`flag-${key}`} className="cursor-pointer text-sm font-medium">
                    {label}
                  </label>
                  <p className="text-xs text-muted">{t(`platform.flags.keys.${key}.hint`, { defaultValue: flag.description })}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {!flag.visible_to_org && <Badge tone="info">{t('platform.flags.hiddenFromOrg')}</Badge>}
                    {flag.depends_on.length > 0 && (
                      <Badge>
                        {t('platform.flags.dependsOn', { list: flag.depends_on.map((d) => t(`platform.flags.keys.${d}.label`, { defaultValue: d })).join(', ') })}
                      </Badge>
                    )}
                    {blocked && <Badge tone="warning">{t('platform.flags.blocked')}</Badge>}
                    {changed && <Badge tone="warning">{t('platform.flags.unsaved')}</Badge>}
                  </div>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input id={`flag-${key}`} type="checkbox" role="switch" className="peer sr-only" checked={on} aria-label={label} onChange={(e) => toggle(key, e.target.checked)} />
                  <span className={cn('h-6 w-11 rounded-full border border-border bg-bg transition peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2')} aria-hidden />
                  <span className="pointer-events-none absolute left-0.5 size-5 rounded-full bg-surface shadow transition peer-checked:translate-x-5" aria-hidden />
                </label>
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="flags-reason" className="block text-sm font-medium">
            {t('platform.flags.reason')}
          </label>
          <input
            id="flags-reason"
            className="mt-1.5 h-10 w-full rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          disabled={count === 0 || saving}
          onClick={() => {
            setDraft({})
            setReason('')
          }}
        >
          {t('platform.flags.discard')}
        </Button>
        <Button
          loading={saving}
          disabled={count === 0}
          onClick={() => {
            // Keep the staged changes when saving fails; the caller shows the error.
            void onSave(changes, reason.trim()).then(
              () => {
                setDraft({})
                setReason('')
              },
              () => undefined,
            )
          }}
        >
          {t('platform.flags.save', { count })}
        </Button>
      </div>
    </div>
  )
}

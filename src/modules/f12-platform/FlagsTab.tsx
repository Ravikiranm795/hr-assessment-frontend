import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { QueryBlock } from './common'
import { FlagGrid } from './FlagGrid'
import { useOrgContext } from './queries'
import type { CatalogFlag, OrgFlagState } from './types'

/** Per-organization feature flags, including the watermark flag that organizations never see. */
export function FlagsTab() {
  const { t } = useTranslation()
  const org = useOrgContext()
  const toast = useToast()
  const client = useQueryClient()
  const key = ['platform', 'org', org.id, 'flags']

  const catalog = useQuery({ queryKey: ['platform', 'catalog'], queryFn: () => api.get<{ items: CatalogFlag[] }>('/api/v1/platform/features/catalog'), staleTime: 5 * 60_000 })
  const flags = useQuery({ queryKey: key, queryFn: () => api.get<{ flags: Record<string, OrgFlagState> }>(`/api/v1/platform/orgs/${org.id}/features`) })

  const save = useMutation({
    mutationFn: ({ changes, reason }: { changes: Record<string, boolean>; reason: string }) =>
      api.put(`/api/v1/platform/orgs/${org.id}/features`, { flags: changes, reason: reason || null }),
    onSuccess: () => {
      toast.success(t('platform.flags.saved'))
      void client.invalidateQueries({ queryKey: key })
    },
    onError: (error) => toast.error(error),
  })

  const states = flags.data?.flags
  return (
    <QueryBlock query={catalog.isError ? catalog : flags}>
      {catalog.data && states && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('platform.flags.orgBody')}</p>
          <FlagGrid
            catalog={catalog.data.items}
            stored={Object.fromEntries(Object.entries(states).map(([k, s]) => [k, s.enabled]))}
            effective={Object.fromEntries(Object.entries(states).map(([k, s]) => [k, s.effective]))}
            saving={save.isPending}
            onSave={(changes, reason) => save.mutateAsync({ changes, reason })}
          />
        </div>
      )}
    </QueryBlock>
  )
}

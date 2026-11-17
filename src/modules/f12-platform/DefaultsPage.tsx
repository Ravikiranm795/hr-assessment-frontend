import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { PageHeader, QueryBlock } from './common'
import { FlagGrid } from './FlagGrid'
import type { CatalogFlag } from './types'

/** Default flag set copied into every new organization. Existing organizations keep their values. */
export function DefaultsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const client = useQueryClient()
  const key = ['platform', 'flag-defaults']

  const catalog = useQuery({ queryKey: ['platform', 'catalog'], queryFn: () => api.get<{ items: CatalogFlag[] }>('/api/v1/platform/features/catalog'), staleTime: 5 * 60_000 })
  const defaults = useQuery({ queryKey: key, queryFn: () => api.get<{ defaults: Record<string, boolean> }>('/api/v1/platform/features/defaults') })

  const save = useMutation({
    mutationFn: ({ changes, reason }: { changes: Record<string, boolean>; reason: string }) =>
      api.put('/api/v1/platform/features/defaults', { defaults: changes, reason: reason || null }),
    onSuccess: () => {
      toast.success(t('platform.flags.defaultsSaved'))
      void client.invalidateQueries({ queryKey: key })
    },
    onError: (error) => toast.error(error),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t('platform.flags.defaultsTitle')} subtitle={t('platform.flags.defaultsBody')} />
      <QueryBlock query={catalog.isError ? catalog : defaults}>
        {catalog.data && defaults.data && (
          <FlagGrid catalog={catalog.data.items} stored={defaults.data.defaults} saving={save.isPending} onSave={(changes, reason) => save.mutateAsync({ changes, reason })} />
        )}
      </QueryBlock>
    </div>
  )
}

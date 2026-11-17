import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import { Select } from './common'

export interface DocRow {
  id: string
  doc_type: string
  title: string
  version_count: number
  current_version_id: string | null
  current_version_no: number | null
  updated_at: string
}
interface DocPage {
  items: DocRow[]
  total: number
}

export function DocumentsPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20 })
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('consent')
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['settings', 'documents', list],
    queryFn: () => api.get<DocPage>('/api/v1/org/documents', { page: list.page, page_size: list.pageSize }),
    placeholderData: (p) => p,
  })

  const create = useMutation({
    mutationFn: () => api.post<DocRow>('/api/v1/org/documents', { doc_type: type, title: title.trim() }),
    onSuccess: (doc) => {
      void client.invalidateQueries({ queryKey: ['settings', 'documents'] })
      setOpen(false)
      setTitle('')
      navigate(`/settings/documents/${doc.id}`)
    },
    onError: (e) => setError(errorText(e)),
  })

  const columns: Column<DocRow>[] = [
    { key: 'title', header: t('settings.documents.columns.title'), cell: (d) => <span className="font-medium">{d.title}</span> },
    { key: 'type', header: t('settings.documents.columns.type'), cell: (d) => <Badge>{t(`settings.documents.type_${d.doc_type}`, { defaultValue: d.doc_type })}</Badge> },
    { key: 'version', header: t('settings.documents.columns.version'), cell: (d) => (d.current_version_no ? t('settings.documents.versionNo', { n: d.current_version_no }) : <span className="text-muted">{t('settings.documents.noVersion')}</span>) },
    { key: 'updated', header: t('settings.documents.columns.updated'), cell: (d) => formatDateTime(d.updated_at, me?.organization?.timezone) },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('settings.documents.title')}</h1>
          <p className="text-sm text-muted">{t('settings.documents.subtitle')}</p>
        </div>
        <Button onClick={() => { setError(null); setOpen(true) }}>{t('settings.documents.new')}</Button>
      </header>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        total={query.data?.total ?? 0}
        state={list}
        onState={setList}
        rowKey={(d) => d.id}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(d) => navigate(`/settings/documents/${d.id}`)}
        emptyTitle={t('settings.documents.empty.title')}
        emptyBody={t('settings.documents.empty.body')}
      />

      <Modal open={open} onOpenChange={setOpen} title={t('settings.documents.newTitle')}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate() }}>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <Field label={t('settings.documents.docTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select id="doc-type" label={t('settings.documents.docType')} value={type} onChange={setType}>
            {['privacy', 'terms', 'consent', 'other'].map((k) => (
              <option key={k} value={k}>{t(`settings.documents.type_${k}`)}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>{t('settings.documents.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

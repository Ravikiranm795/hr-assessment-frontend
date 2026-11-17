import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DataTable, type Column, type ListState } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Textarea } from '@/components/Textarea'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText, fieldErrorText } from '@/core/api/errors'
import { formatDateTime } from '@/core/utils'
import { useOrgContext } from './queries'
import type { MisuseFlag, Paged } from './types'

/** Misuse flags for one organization: raise with a mandatory comment, clear with a closing note (spec F12, A-11). */
export function MisuseTab() {
  const { t } = useTranslation()
  const org = useOrgContext()
  const client = useQueryClient()
  const toast = useToast()
  const [list, setList] = useState<ListState>({ page: 1, pageSize: 20, sort: 'raised_at:desc' })
  const [status, setStatus] = useState('')
  const [raising, setRaising] = useState(false)
  const [clearing, setClearing] = useState<MisuseFlag | null>(null)

  const query = useQuery({
    queryKey: ['platform', 'org', org.id, 'misuse', list, status],
    queryFn: () => api.get<Paged<MisuseFlag>>(`/api/v1/platform/orgs/${org.id}/misuse-flags`, { page: list.page, page_size: list.pageSize, sort: list.sort, status: status || undefined }),
    placeholderData: (previous) => previous,
  })
  const refresh = () => void client.invalidateQueries({ queryKey: ['platform', 'org', org.id, 'misuse'] })

  const columns: Column<MisuseFlag>[] = [
    { key: 'raised', header: t('platform.misuse.columns.raised'), sortField: 'raised_at', cell: (f) => formatDateTime(f.raised_at) },
    { key: 'comment', header: t('platform.misuse.columns.comment'), cell: (f) => <p className="max-w-md whitespace-pre-wrap">{f.comment}</p> },
    {
      key: 'status',
      header: t('platform.misuse.columns.status'),
      cell: (f) => (
        <div className="space-y-1">
          <Badge tone={f.status === 'open' ? 'warning' : 'neutral'}>{t(`platform.misuse.status.${f.status}`, { defaultValue: f.status })}</Badge>
          {f.closing_note && <p className="max-w-xs text-xs whitespace-pre-wrap text-muted">{t('platform.misuse.closingNote', { note: f.closing_note })}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'w-28 text-right',
      cell: (f) =>
        f.status === 'open' ? (
          <Button size="sm" variant="outline" onClick={() => setClearing(f)}>
            {t('platform.misuse.clear')}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="misuse-status" className="sr-only">
            {t('platform.misuse.filter.label')}
          </label>
          <select
            id="misuse-status"
            className="h-10 rounded-(--radius) border border-border bg-surface px-3 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setList((s) => ({ ...s, page: 1 }))
            }}
          >
            <option value="">{t('platform.misuse.filter.all')}</option>
            <option value="open">{t('platform.misuse.status.open')}</option>
            <option value="cleared">{t('platform.misuse.status.cleared')}</option>
          </select>
        </div>
        <Button onClick={() => setRaising(true)}>{t('platform.misuse.raise')}</Button>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        total={query.data?.total ?? 0}
        state={list}
        onState={setList}
        rowKey={(f) => f.id}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('platform.misuse.empty.title')}
        emptyBody={t('platform.misuse.empty.body')}
      />

      <NoteDialog
        open={raising}
        onOpenChange={setRaising}
        title={t('platform.misuse.raiseDialog.title', { name: org.name })}
        body={t('platform.misuse.raiseDialog.body')}
        label={t('platform.misuse.raiseDialog.comment')}
        submit={t('platform.misuse.raiseDialog.submit')}
        danger
        run={(note) => api.post(`/api/v1/platform/orgs/${org.id}/misuse-flags`, { comment: note })}
        field="comment"
        onDone={() => {
          toast.success(t('platform.misuse.raised'))
          refresh()
        }}
      />
      <NoteDialog
        open={clearing !== null}
        onOpenChange={(open) => !open && setClearing(null)}
        title={t('platform.misuse.clearDialog.title')}
        body={clearing ? t('platform.misuse.clearDialog.body', { comment: clearing.comment }) : ''}
        label={t('platform.misuse.clearDialog.note')}
        submit={t('platform.misuse.clearDialog.submit')}
        run={(note) => api.post(`/api/v1/platform/misuse-flags/${clearing?.id}/clear`, { closing_note: note })}
        field="closing_note"
        onDone={() => {
          toast.success(t('platform.misuse.cleared'))
          setClearing(null)
          refresh()
        }}
      />
    </div>
  )
}

interface NoteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  label: string
  submit: string
  danger?: boolean
  /** Server field name to attach a validation error to. */
  field: string
  run: (note: string) => Promise<unknown>
  onDone: () => void
}

/** Dialog with one mandatory free-text note (misuse comment or closing note). */
function NoteDialog({ open, onOpenChange, title, body, label, submit, danger, field, run, onDone }: NoteProps) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const close = (next: boolean) => {
    if (!next) {
      setNote('')
      setError(null)
    }
    onOpenChange(next)
  }
  const send = useMutation({
    mutationFn: () => run(note.trim()),
    onSuccess: () => {
      close(false)
      onDone()
    },
    onError: (e) => {
      const fieldError = e instanceof ApiError ? e.fieldErrors.find((f) => f.field.split('.').pop() === field) : undefined
      setError(fieldError ? fieldErrorText(fieldError.code) : errorText(e))
    },
  })

  return (
    <Modal open={open} onOpenChange={close} title={title} description={body}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!note.trim()) {
            setError(t('fieldErrors.required'))
            return
          }
          setError(null)
          send.mutate()
        }}
      >
        <Textarea label={label} value={note} maxLength={2000} error={error ?? undefined} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={send.isPending}>
            {submit}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

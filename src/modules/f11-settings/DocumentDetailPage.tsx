import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { Html } from '@/components/Html'
import { Modal } from '@/components/Modal'
import { RichTextEditor } from '@/components/RichTextEditor'
import { Spinner } from '@/components/Spinner'
import { StatePage } from '@/components/StatePage'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime } from '@/core/utils'
import type { DocRow } from './DocumentsPage'

interface Version {
  id: string
  version_no: number
  status: string
  content_html: string | null
  pdf_url: string | null
  published_at: string | null
  created_at: string
}

/** Versions of one policy document: write HTML (Tiptap) or upload a PDF, then publish (spec F11 Documents). */
export function DocumentDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { me } = useAuth()
  const toast = useToast()
  const client = useQueryClient()
  const tz = me?.organization?.timezone
  const [writing, setWriting] = useState(false)
  const [mode, setMode] = useState<'write' | 'upload'>('write')
  const [html, setHtml] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Version | null>(null)
  const [publishing, setPublishing] = useState<Version | null>(null)

  const doc = useQuery({ queryKey: ['settings', 'document', id], queryFn: () => api.get<DocRow>(`/api/v1/org/documents/${id}`) })
  const versions = useQuery({ queryKey: ['settings', 'document', id, 'versions'], queryFn: () => api.get<{ items: Version[] }>(`/api/v1/org/documents/${id}/versions`) })
  const refresh = () => void client.invalidateQueries({ queryKey: ['settings', 'document', id] })

  const create = useMutation({
    mutationFn: () => {
      if (mode === 'upload' && file) {
        const form = new FormData()
        form.append('file', file)
        return api.upload(`/api/v1/org/documents/${id}/versions`, form)
      }
      return api.post(`/api/v1/org/documents/${id}/versions`, { content_html: html })
    },
    onSuccess: () => {
      toast.success(t('settings.documents.draftSaved'))
      setWriting(false)
      setHtml('')
      setFile(null)
      refresh()
    },
    onError: (e) => {
      const reason = e instanceof ApiError && typeof e.details.reason === 'string' ? `: ${e.details.reason}` : ''
      setError(errorText(e) + reason)
    },
  })
  const publish = useMutation({
    mutationFn: (v: Version) => api.post(`/api/v1/org/documents/${id}/versions/${v.id}/publish`),
    onSuccess: () => {
      toast.success(t('settings.documents.published'))
      setPublishing(null)
      refresh()
    },
    onError: (e) => {
      setPublishing(null)
      toast.error(e)
    },
  })

  if (doc.isPending) return <Spinner label={t('common.loading')} className="py-20" />
  if (doc.error instanceof ApiError && [403, 404].includes(doc.error.status)) return <StatePage title={t('notFound.title')} body={t('notFound.body')} />
  if (doc.isError) return <ErrorState error={doc.error} onRetry={() => void doc.refetch()} />

  const canSave = mode === 'upload' ? !!file : html.trim().length > 0
  const sorted = [...(versions.data?.items ?? [])].sort((a, b) => b.version_no - a.version_no)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/settings/documents" className="text-sm text-primary underline">
        ← {t('settings.documents.back')}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{doc.data.title}</h1>
          <Badge>{t(`settings.documents.type_${doc.data.doc_type}`, { defaultValue: doc.data.doc_type })}</Badge>
        </div>
        <Button onClick={() => { setError(null); setMode('write'); setWriting(true) }}>{t('settings.documents.newVersion')}</Button>
      </header>

      <section aria-labelledby="versions-title">
        <h2 id="versions-title" className="mb-2 font-semibold">
          {t('settings.documents.versions')}
        </h2>
        {versions.isPending && <Spinner label={t('common.loading')} />}
        {versions.isError && <ErrorState error={versions.error} onRetry={() => void versions.refetch()} />}
        {versions.data && sorted.length === 0 && <p className="text-sm text-muted">{t('settings.documents.noVersions')}</p>}
        <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface shadow-card">
          {sorted.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-medium">{t('settings.documents.versionNo', { n: v.version_no })}</span>
                <Badge tone={v.status === 'published' ? 'success' : 'warning'}>{t(`settings.documents.status_${v.status}`, { defaultValue: v.status })}</Badge>
                <span className="text-xs text-muted">{formatDateTime(v.published_at ?? v.created_at, tz)}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setViewing(v)}>
                  {t('settings.documents.view')}
                </Button>
                {v.status !== 'published' && (
                  <Button size="sm" onClick={() => setPublishing(v)}>
                    {t('settings.documents.publish')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={writing} onOpenChange={setWriting} title={t('settings.documents.newVersionTitle')} wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate() }}>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <div className="flex gap-1 border-b border-border" role="tablist">
            {(['write', 'upload'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`border-b-2 px-4 py-2 text-sm font-medium ${mode === m ? 'border-primary text-text' : 'border-transparent text-muted'}`}>
                {t(`settings.documents.${m}`)}
              </button>
            ))}
          </div>
          {mode === 'write' ? (
            <RichTextEditor key={String(writing)} value="" onChange={setHtml} label={t('settings.documents.content')} />
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="doc-pdf" className="block text-sm font-medium">{t('settings.documents.pdfFile')}</label>
              <input id="doc-pdf" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-sm" />
              <p className="text-xs text-muted">{t('settings.documents.pdfHint')}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWriting(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={create.isPending} disabled={!canSave}>{t('settings.documents.saveDraft')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)} title={t('settings.documents.viewTitle', { n: viewing?.version_no })} wide>
        {viewing?.pdf_url ? (
          <a href={viewing.pdf_url} target="_blank" rel="noreferrer" className="text-primary underline">
            {t('settings.documents.openPdf')}
          </a>
        ) : (
          <Html html={viewing?.content_html ?? ''} />
        )}
      </Modal>

      <ConfirmDialog
        open={publishing !== null}
        onOpenChange={(o) => !o && setPublishing(null)}
        title={t('settings.documents.publishTitle', { n: publishing?.version_no })}
        body={t('settings.documents.publishBody')}
        confirmLabel={t('settings.documents.publish')}
        loading={publish.isPending}
        onConfirm={() => publishing && publish.mutate(publishing)}
      />
    </div>
  )
}

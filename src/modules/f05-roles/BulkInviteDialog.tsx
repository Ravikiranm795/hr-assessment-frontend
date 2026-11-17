import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { api } from '@/core/api/client'
import { errorText } from '@/core/api/errors'
import { roleKeys } from './api'
import { CopyButton } from './ExamUrlDialog'
import type { BulkResult } from './types'
import { Banner, Dialog } from './ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleId: string
}

/** CSV with header `name,email,phone`, at most 200 rows. Each row reports on its own; URLs are shown once. */
export function BulkInviteDialog({ open, onOpenChange, roleId }: Props) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [result, setResult] = useState<BulkResult | null>(null)

  const upload = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData()
      form.append('file', f)
      return api.upload<BulkResult>(`/api/v1/roles/${roleId}/invites/bulk`, form)
    },
    onSuccess: (data) => {
      setResult(data)
      void client.invalidateQueries({ queryKey: roleKeys.all })
    },
    onError: (error) => setBanner(errorText(error)),
  })

  function close(next: boolean) {
    if (!next) {
      setFile(null)
      setBanner(null)
      setResult(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close} wide title={t('roles.bulk.title')} description={t('roles.bulk.body')}>
      {result ? (
        <div className="space-y-4">
          <p className="text-sm" role="status">
            {t('roles.bulk.summary', { total: result.total, created: result.created, failed: result.failed })}
          </p>
          <Banner kind="warning">{t('roles.bulk.once')}</Banner>
          <div className="max-h-80 overflow-y-auto rounded-(--radius) border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('roles.bulk.row')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('roles.bulk.result')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('roles.bulk.link')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.row} className="border-t border-border">
                    <td className="px-3 py-2">{row.row}</td>
                    <td className="px-3 py-2">
                      {row.status === 'created'
                        ? t('roles.bulk.created')
                        : t(`roles.bulk.code.${row.code}`, { defaultValue: t('roles.bulk.code.other') })}
                    </td>
                    <td className="px-3 py-2">{row.exam_url && <CopyButton value={row.exam_url} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => close(false)}>{t('roles.url.done')}</Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setBanner(null)
            if (file) upload.mutate(file)
          }}
        >
          {banner && <Banner kind="error">{banner}</Banner>}
          <div className="space-y-1.5">
            <label htmlFor="bulk-csv" className="block text-sm font-medium">
              {t('roles.bulk.file')}
            </label>
            <input
              id="bulk-csv"
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted">{t('roles.bulk.format')}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!file} loading={upload.isPending}>
              {t('roles.bulk.upload')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

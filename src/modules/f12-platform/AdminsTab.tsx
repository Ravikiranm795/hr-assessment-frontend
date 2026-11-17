import { zodResolver } from '@hookform/resolvers/zod'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import { formatDateTime } from '@/core/utils'
import { useOrgContext } from './queries'
import { TempPasswordDialog } from './TempPasswordDialog'
import type { OrgUser, Paged, TempPassword } from './types'

const schema = z.object({ name: z.string().trim().min(1), email: z.string().trim().min(1) })
type Values = z.infer<typeof schema>

type Confirm = { kind: 'reset' | 'reactivate' | 'deactivate' | 'deactivateLast'; user: OrgUser }
const item = 'cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-bg'

/** Organization admins are managed only here (spec F12, A-02): the org's own admins cannot create or change each other. */
export function AdminsTab() {
  const { t } = useTranslation()
  const org = useOrgContext()
  const toast = useToast()
  const client = useQueryClient()
  const key = ['platform', 'org', org.id, 'admins']
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [temp, setTemp] = useState<TempPassword | null>(null)

  // The API has no admin-only list: read the organization's users page by page and keep the administrators.
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const admins: OrgUser[] = []
      for (let page = 1; page <= 20; page += 1) {
        const data = await api.get<Paged<OrgUser>>(`/api/v1/platform/orgs/${org.id}/users`, { page, page_size: 100 })
        admins.push(...data.items.filter((u) => u.role === 'org_admin'))
        if (page * data.page_size >= data.total) break
      }
      return admins
    },
  })
  const refresh = () => void client.invalidateQueries({ queryKey: ['platform', 'org', org.id] })
  const fail = (error: unknown) => {
    setConfirm(null)
    toast.error(error)
  }
  const done = (message: string) => {
    setConfirm(null)
    toast.success(message)
    refresh()
  }

  const base = (u: OrgUser) => `/api/v1/platform/users/${u.id}`
  const reset = useMutation({
    mutationFn: (u: OrgUser) => api.post<{ temporary_password: string }>(`${base(u)}/reset-password`),
    onSuccess: (data, u) => {
      setConfirm(null)
      refresh()
      setTemp({ name: u.name, password: data.temporary_password })
    },
    onError: fail,
  })
  const reactivate = useMutation({ mutationFn: (u: OrgUser) => api.post(`${base(u)}/reactivate`), onSuccess: () => done(t('platform.admins.toast.reactivated')), onError: fail })
  const unlock = useMutation({ mutationFn: (u: OrgUser) => api.post(`${base(u)}/unlock`), onSuccess: () => done(t('platform.admins.toast.unlocked')), onError: fail })
  const deactivate = useMutation({
    mutationFn: ({ user, last }: { user: OrgUser; last: boolean }) => api.post(`${base(user)}/deactivate`, { confirm_last_admin: last }),
    onSuccess: () => done(t('platform.admins.toast.deactivated')),
    onError: (error, { user, last }) => {
      // The last active admin needs an explicit second confirmation (A-04).
      if (!last && error instanceof ApiError && error.code === 'LAST_ADMIN_PROTECTED') setConfirm({ kind: 'deactivateLast', user })
      else fail(error)
    },
  })

  const columns: Column<OrgUser>[] = [
    {
      key: 'name',
      header: t('platform.users.columns.name'),
      cell: (u) => (
        <div>
          <p className="font-medium">{u.name}</p>
          <p className="text-xs text-muted">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('platform.users.columns.status'),
      cell: (u) => (
        <div className="flex gap-1.5">
          <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>{t(`platform.userStatus.${u.status}`, { defaultValue: u.status })}</Badge>
          {u.is_locked && <Badge tone="warning">{t('platform.userStatus.locked')}</Badge>}
        </div>
      ),
    },
    { key: 'last', header: t('platform.users.columns.lastLogin'), cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : t('platform.users.never')) },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'w-24 text-right',
      cell: (u) => (
        <Dropdown.Root>
          <Dropdown.Trigger className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text" aria-label={t('platform.admins.menu', { name: u.name })}>
            <MoreHorizontal className="size-5" aria-hidden />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" className="z-40 min-w-52 rounded-(--radius) border border-border bg-surface p-1 shadow-card">
              {u.status === 'active' && <Dropdown.Item className={item} onSelect={() => setConfirm({ kind: 'reset', user: u })}>{t('platform.admins.resetPassword')}</Dropdown.Item>}
              {u.is_locked && <Dropdown.Item className={item} onSelect={() => unlock.mutate(u)}>{t('platform.admins.unlock')}</Dropdown.Item>}
              {u.status === 'active' ? (
                <Dropdown.Item className={item} onSelect={() => setConfirm({ kind: 'deactivate', user: u })}>{t('platform.admins.deactivate')}</Dropdown.Item>
              ) : (
                <Dropdown.Item className={item} onSelect={() => setConfirm({ kind: 'reactivate', user: u })}>{t('platform.admins.reactivate')}</Dropdown.Item>
              )}
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      ),
    },
  ]

  const name = confirm?.user.name ?? ''
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('platform.admins.hint')}</p>
        <Button onClick={() => setAdding(true)}>{t('platform.admins.add')}</Button>
      </div>

      <DataTable
        columns={columns}
        rows={query.data}
        total={query.data?.length ?? 0}
        state={{ page: 1, pageSize: 100 }}
        onState={() => undefined}
        rowKey={(u) => u.id}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('platform.admins.empty')}
      />

      <AddAdminDialog
        open={adding}
        onOpenChange={setAdding}
        orgId={org.id}
        onCreated={(user, password) => {
          refresh()
          setTemp({ name: user.name, password })
        }}
      />
      <TempPasswordDialog value={temp} onClose={() => setTemp(null)} />

      <ConfirmDialog
        open={confirm?.kind === 'reset'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('platform.admins.confirm.resetTitle', { name })}
        body={t('platform.admins.confirm.resetBody')}
        confirmLabel={t('platform.admins.resetPassword')}
        loading={reset.isPending}
        onConfirm={() => confirm && reset.mutate(confirm.user)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'reactivate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('platform.admins.confirm.reactivateTitle', { name })}
        body={t('platform.admins.confirm.reactivateBody')}
        confirmLabel={t('platform.admins.reactivate')}
        loading={reactivate.isPending}
        onConfirm={() => confirm && reactivate.mutate(confirm.user)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'deactivate'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('platform.admins.confirm.deactivateTitle', { name })}
        body={t('platform.admins.confirm.deactivateBody')}
        confirmLabel={t('platform.admins.deactivate')}
        danger
        loading={deactivate.isPending}
        onConfirm={() => confirm && deactivate.mutate({ user: confirm.user, last: false })}
      />
      <ConfirmDialog
        open={confirm?.kind === 'deactivateLast'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('platform.admins.confirm.lastTitle', { name })}
        body={t('platform.admins.confirm.lastBody')}
        confirmLabel={t('platform.admins.confirm.lastConfirm')}
        danger
        loading={deactivate.isPending}
        onConfirm={() => confirm && deactivate.mutate({ user: confirm.user, last: true })}
      />
    </div>
  )
}

function AddAdminDialog({ open, onOpenChange, orgId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; orgId: string; onCreated: (user: OrgUser, password: string) => void }) {
  const { t } = useTranslation()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const create = useMutation({
    mutationFn: (v: Values) => api.post<{ user: OrgUser; temporary_password: string }>(`/api/v1/platform/orgs/${orgId}/admins`, v),
    onSuccess: (data) => {
      reset()
      onOpenChange(false)
      onCreated(data.user, data.temporary_password)
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setBanner(errorText(error))
    },
  })

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          setBanner(null)
        }
        onOpenChange(next)
      }}
      title={t('platform.admins.addDialog.title')}
      description={t('platform.admins.addDialog.body')}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) => {
          setBanner(null)
          create.mutate(v)
        })}
      >
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        <Field label={t('platform.admins.addDialog.name')} autoComplete="off" error={errors.name && (errors.name.type === 'server' ? errors.name.message : t('fieldErrors.required'))} {...register('name')} />
        <Field label={t('platform.admins.addDialog.email')} type="email" autoComplete="off" error={errors.email && (errors.email.type === 'server' ? errors.email.message : t('fieldErrors.required'))} {...register('email')} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t('platform.admins.addDialog.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

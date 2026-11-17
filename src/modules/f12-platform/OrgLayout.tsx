import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { StatePage } from '@/components/StatePage'
import { Textarea } from '@/components/Textarea'
import { useToast } from '@/components/Toast'
import { api } from '@/core/api/client'
import { ApiError } from '@/core/api/errors'
import { cn } from '@/core/utils'
import { OrgStatusBadge } from './common'
import { platformKeys, useOrg } from './queries'
import type { Org } from './types'

const TABS = ['overview', 'users', 'roles', 'admins', 'flags', 'misuse'] as const

export function OrgLayout() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const toast = useToast()
  const client = useQueryClient()
  const query = useOrg(id)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')

  const org = query.data
  const disabled = org?.status === 'disabled'
  const toggle = useMutation({
    mutationFn: () => api.post<Org>(`/api/v1/platform/orgs/${id}/${disabled ? 'enable' : 'disable'}`, reason.trim() ? { reason: reason.trim() } : undefined),
    onSuccess: () => {
      toast.success(t(disabled ? 'platform.org.enabledToast' : 'platform.org.disabledToast'))
      setConfirming(false)
      setReason('')
      void client.invalidateQueries({ queryKey: platformKeys.all })
    },
    onError: (error) => {
      setConfirming(false)
      toast.error(error)
    },
  })

  if (query.isPending) return <Spinner label={t('common.loading')} className="py-20" />
  // An id from nowhere (or another tenant) answers 404: show the normal not-found page (spec 8.2).
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) {
    return <StatePage title={t('notFound.title')} body={t('notFound.body')} />
  }
  if (query.isError || !org) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav aria-label={t('platform.org.breadcrumb')} className="text-sm text-muted">
        <Link to="/platform/orgs" className="hover:underline">
          {t('platform.orgs.title')}
        </Link>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{org.slug}</span>
            <OrgStatusBadge status={org.status} />
            {org.is_demo && <Badge tone="info">{t('platform.orgs.demo')}</Badge>}
          </div>
        </div>
        <Button variant={disabled ? 'primary' : 'outline'} onClick={() => setConfirming(true)}>
          {t(disabled ? 'platform.org.enable' : 'platform.org.disable')}
        </Button>
      </header>

      <nav aria-label={t('platform.org.tabs')} className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab}
            to={`/platform/orgs/${id}/${tab}`}
            className={({ isActive }) =>
              cn('rounded-t-(--radius) border-b-2 px-4 py-2 text-sm font-medium', isActive ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text')
            }
          >
            {t(`platform.org.tab.${tab}`)}
          </NavLink>
        ))}
      </nav>

      <Outlet context={org} />

      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        title={t(disabled ? 'platform.org.enableTitle' : 'platform.org.disableTitle', { name: org.name })}
        description={t(disabled ? 'platform.org.enableBody' : 'platform.org.disableBody')}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            toggle.mutate()
          }}
        >
          <Textarea label={t('platform.org.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant={disabled ? 'primary' : 'danger'} loading={toggle.isPending}>
              {t(disabled ? 'platform.org.enable' : 'platform.org.disable')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

import * as Popover from '@radix-ui/react-popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/Button'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { cn, formatDateTime } from '@/core/utils'
import { notificationTarget, type Notification } from './notificationTarget'

interface Page {
  items: Notification[]
  total: number
}

const POLL_MS = 30_000 // no push in phase one (spec 8.8)

export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/api/v1/notifications/unread-count'),
    refetchInterval: POLL_MS,
  })
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<Page>('/api/v1/notifications', { page_size: 20 }),
    enabled: open,
  })
  const refresh = () => client.invalidateQueries({ queryKey: ['notifications'] })
  const markOne = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`),
    onSuccess: refresh,
  })
  const markAll = useMutation({ mutationFn: () => api.post('/api/v1/notifications/read-all'), onSuccess: refresh })

  const count = unread.data?.unread ?? 0
  const typeText = (type: string) => (i18n.exists(`notifications.type.${type}`) ? t(`notifications.type.${type}`) : t('notifications.type.unknown'))

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="relative flex size-10 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text"
        aria-label={`${t('notifications.title')}${count ? `, ${t('notifications.unread', { count })}` : ''}`}
      >
        <Bell className="size-5" aria-hidden />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-contrast">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-40 w-96 rounded-(--radius) border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
            <Button size="sm" variant="ghost" disabled={count === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>
              {t('notifications.markAll')}
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.isError && <div className="p-3"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>}
            {list.data?.items.length === 0 && <p className="p-6 text-center text-sm text-muted">{t('notifications.empty')}</p>}
            <ul>
              {list.data?.items.map((n) => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    className={cn('flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-bg', !n.read_at && 'font-medium')}
                    onClick={() => {
                      if (!n.read_at) markOne.mutate(n.id)
                      setOpen(false)
                      navigate(notificationTarget(n))
                    }}
                  >
                    <span>{typeText(n.type)}</span>
                    <span className="text-xs font-normal text-muted">{formatDateTime(n.created_at, me?.organization?.timezone)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

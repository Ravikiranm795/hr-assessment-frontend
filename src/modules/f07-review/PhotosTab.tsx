import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/core/auth/AuthProvider'
import { cn, formatDateTime } from '@/core/utils'
import { deletePhotos, listPhotos, photoUrl } from './photosApi'
import { applyServerMessage } from './serverErrors'
import type { Attempt, PhotoItem } from './types'
import { SnapshotModal } from './ViolationsTab'

const RING = {
  serious: 'ring-2 ring-error',
  moderate: 'ring-2 ring-warning',
  minor: 'ring-2 ring-primary',
} as const
const TONE = { serious: 'error', moderate: 'warning', minor: 'info' } as const

export function PhotosTab({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const [violationsOnly, setViolationsOnly] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const purged = !!attempt.photos_purged_at

  const query = useInfiniteQuery({
    queryKey: ['attempt-photos', attempt.id, attempt.photos_purged_at ?? null],
    queryFn: ({ pageParam }) => listPhotos(attempt.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !purged,
  })

  const typeText = (type: string | null) =>
    type && i18n.exists(`review.violations.type.${type}`) ? t(`review.violations.type.${type}`) : t('review.violations.type.unknown')

  const items = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.items) ?? []
    const sorted = [...all.filter((p) => p.kind === 'baseline'), ...all.filter((p) => p.kind !== 'baseline')]
    return violationsOnly ? sorted.filter((p) => p.event_id) : sorted
  }, [query.data, violationsOnly])

  const label = (p: PhotoItem) => (p.kind === 'baseline' ? t('review.violations.baseline') : p.event_id ? typeText(p.event_type) : t('review.photos.periodic'))

  return (
    <div className="space-y-4">
      <Retention attempt={attempt} onChanged={onChanged} />

      {purged ? (
        <p className="rounded-(--radius) border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          {t('review.photos.purged', { date: formatDateTime(attempt.photos_purged_at, tz) })}
        </p>
      ) : query.isPending ? (
        <Spinner label={t('common.loading')} className="py-10" />
      ) : query.isError ? (
        <div className="space-y-2 text-sm">
          <p role="alert" className="text-error">{applyServerMessage(query.error)}</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>{t('common.retry', { defaultValue: 'Retry' })}</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{t('review.photos.count', { count: query.data.pages[0]?.total ?? 0 })}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={violationsOnly} onChange={(e) => setViolationsOnly(e.target.checked)} />
              {t('review.photos.violationsOnly')}
            </label>
          </div>

          {items.length === 0 ? (
            <p className="rounded-(--radius) border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">{t('review.photos.empty')}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((p, i) => (
                <li key={p.asset_id}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(i)}
                    className={cn('block w-full overflow-hidden rounded-(--radius) border border-border bg-surface text-left shadow-card', p.severity && RING[p.severity as keyof typeof RING])}
                  >
                    <Thumb attemptId={attempt.id} assetId={p.asset_id} alt={t('review.violations.snapshotAlt')} />
                    <div className="space-y-1 p-2 text-xs">
                      <p className="text-muted">{formatDateTime(p.taken_at, tz)}</p>
                      {(p.event_id || p.kind === 'baseline') && (
                        <Badge tone={p.kind === 'baseline' ? 'neutral' : (TONE[p.severity as keyof typeof TONE] ?? 'neutral')}>{label(p)}</Badge>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.hasNextPage && (
            <div className="text-center">
              <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                {t('review.photos.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      {openIndex !== null && items[openIndex] && (
        <SnapshotModal
          attemptId={attempt.id}
          assetId={items[openIndex].asset_id}
          title={`${label(items[openIndex])} (${formatDateTime(items[openIndex].taken_at, tz)})`}
          onClose={() => setOpenIndex(null)}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={openIndex < items.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined}
        />
      )}
    </div>
  )
}

/** Thumbnail that fetches its signed URL only once it scrolls into view, and again if the URL has expired. */
function Thumb({ attemptId, assetId, alt }: { attemptId: string; assetId: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const load = (fresh: boolean) => {
    photoUrl(attemptId, assetId, fresh)
      .then((u) => {
        setUrl(u)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }
  useEffect(() => {
    if (visible) load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, attemptId, assetId])

  return (
    <div ref={box} className="flex aspect-4/3 items-center justify-center bg-bg">
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" onError={() => load(true)} />
      ) : failed ? (
        <button type="button" className="text-xs text-error underline" onClick={(e) => { e.stopPropagation(); load(true) }}>
          ↻
        </button>
      ) : null}
    </div>
  )
}

function Retention({ attempt, onChanged }: { attempt: Attempt; onChanged: () => void }) {
  const { t } = useTranslation()
  const { me } = useAuth()
  const tz = me?.organization?.timezone
  const [open, setOpen] = useState(false)
  const decided = attempt.decision !== 'waiting'

  if (attempt.photos_purged_at) return null
  if (!decided) return <p className="text-sm text-muted">{t('review.photos.needDecision')}</p>

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-primary/30 bg-primary/10 p-3 text-sm">
      <p>{attempt.photos_delete_after ? t('review.photos.autoDelete', { date: formatDateTime(attempt.photos_delete_after, tz) }) : t('review.photos.autoDeleteLater')}</p>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t('review.photos.deleteNow')}</Button>
      {open && <DeleteModal attemptId={attempt.id} onClose={() => setOpen(false)} onDone={onChanged} />}
    </div>
  )
}

function DeleteModal({ attemptId, onClose, onDone }: { attemptId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const del = useMutation({
    mutationFn: () => deletePhotos(attemptId),
    onSuccess: () => {
      toast.success(t('review.toast.photosDeleted'))
      onClose()
      onDone()
    },
    onError: (e) => setError(applyServerMessage(e)),
  })
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={t('review.photos.deleteTitle')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          del.mutate()
        }}
      >
        <p className="text-sm">{t('review.photos.deleteBody')}</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          {t('review.photos.understand')}
        </label>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={del.isPending} disabled={!understood}>{t('review.photos.deleteConfirm')}</Button>
        </div>
      </form>
    </Modal>
  )
}

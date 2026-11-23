import { api } from '@/core/api/client'
import type { PhotoPage } from './types'

const SIGNED_URL_TTL_MS = 50_000 // signed URLs last about 60 s
const urlCache = new Map<string, { url: string; at: number }>()

export function listPhotos(attemptId: string, cursor: string | null, limit = 24) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (cursor) q.set('cursor', cursor)
  return api.get<PhotoPage>(`/api/v1/attempts/${attemptId}/photos?${q.toString()}`)
}

/** Signed URL for one photo, cached per asset id for the session while still valid; `fresh` forces a refetch. */
export async function photoUrl(attemptId: string, assetId: string, fresh = false): Promise<string> {
  const hit = urlCache.get(assetId)
  if (!fresh && hit && Date.now() - hit.at < SIGNED_URL_TTL_MS) return hit.url
  const d = await api.get<{ url: string }>(`/api/v1/attempts/${attemptId}/snapshots/${assetId}/url`)
  urlCache.set(assetId, { url: d.url, at: Date.now() })
  return d.url
}

export function deletePhotos(attemptId: string) {
  return api.post(`/api/v1/attempts/${attemptId}/photos/delete`, { confirm: true })
}

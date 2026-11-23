import { examApi } from '../examApi'

/** Periodic proof photos: every 15 s by default; the server value is clamped to 10-15 s. */
export const MIN_SNAPSHOT_GAP_S = 10
export const DEFAULT_SNAPSHOT_INTERVAL_S = 15
export const MAX_SNAPSHOTS = 720
const TARGET_BYTES = 40 * 1024

/** Effective interval: default 15 s when missing or larger, never below 10 s. */
export function effectiveSnapshotInterval(serverSeconds: number | null | undefined): number {
  if (typeof serverSeconds !== 'number' || !Number.isFinite(serverSeconds) || serverSeconds <= 0) return DEFAULT_SNAPSHOT_INTERVAL_S
  return Math.min(DEFAULT_SNAPSHOT_INTERVAL_S, Math.max(MIN_SNAPSHOT_GAP_S, serverSeconds))
}

/** Draw the current video frame to a JPEG; null if the camera has no frame yet. */
export function captureFrame(video: HTMLVideoElement, quality = 0.7): Promise<Blob | null> {
  if (video.readyState < 2 || video.videoWidth === 0) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 640 / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) return Promise.resolve(null)
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Periodic camera snapshots, throttled to the backend limits. Failures are silent: a missed snapshot
 * must never disturb the candidate or the exam.
 */
export class SnapshotUploader {
  private timer: ReturnType<typeof setInterval> | null = null
  private sent = 0
  private lastAt = -Infinity
  private readonly getVideo: () => HTMLVideoElement | null
  private busy = false
  private readonly intervalSeconds: number

  constructor(getVideo: () => HTMLVideoElement | null, intervalSeconds: number | null | undefined) {
    this.getVideo = getVideo
    this.intervalSeconds = effectiveSnapshotInterval(intervalSeconds)
  }

  start() {
    this.timer ??= setInterval(() => void this.tick(), this.intervalSeconds * 1000)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async tick() {
    // Never queue a backlog: skip while the previous upload is running, the tab is hidden or the video is not ready.
    if (this.busy || document.hidden) return
    const video = this.getVideo()
    const now = performance.now()
    if (!video || video.paused || this.sent >= MAX_SNAPSHOTS || now - this.lastAt < MIN_SNAPSHOT_GAP_S * 1000) return
    this.busy = true
    try {
      let frame = await captureFrame(video, 0.6)
      if (frame && frame.size > TARGET_BYTES) frame = (await captureFrame(video, 0.45)) ?? frame
      if (!frame) return
      this.lastAt = now
      await examApi.snapshot(frame)
      this.sent += 1
    } catch {
      // rate limited, offline or the exam ended: this photo is dropped, never retried
    } finally {
      this.busy = false
    }
  }
}

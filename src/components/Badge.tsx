import type { ReactNode } from 'react'
import { cn } from '@/core/utils'

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info'
const TONES: Record<Tone, string> = {
  neutral: 'bg-bg text-text border-border',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  error: 'bg-error/10 text-error border-error/30',
  info: 'bg-primary/10 text-primary border-primary/30',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', TONES[tone])}>{children}</span>
}

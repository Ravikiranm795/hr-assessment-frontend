import { useMemo } from 'react'
import { cn } from '@/core/utils'
import { richText, sanitizeHtml } from './html'

/** Renders backend HTML after DOMPurify (spec 8.9). */
export function SafeHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  return <div className={cn('text-sm', richText, className)} dangerouslySetInnerHTML={{ __html: clean }} />
}

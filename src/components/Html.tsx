import DOMPurify from 'dompurify'
import { useMemo } from 'react'
import { cn } from '@/core/utils'

/** Backend-supplied HTML (question prompts, policy text) is always sanitized before rendering (spec 8.9). */
export function Html({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html])
  return <div className={cn('max-w-none [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono', className)} dangerouslySetInnerHTML={{ __html: clean }} />
}

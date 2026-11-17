import DOMPurify from 'dompurify'

/** Every backend-supplied HTML string goes through DOMPurify before it is rendered (spec 8.9). */
export function sanitizeHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } })
}

/** Plain text of an HTML snippet, used to tell whether a rich-text field is empty. */
export function htmlToText(html: string | null | undefined): string {
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html')
  return (doc.body.textContent ?? '').trim()
}

/** Typography for rich text (Tailwind's reset strips list and code styles). Shared with the editor. */
export const richText =
  '[&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-(--radius) [&_pre]:bg-bg [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:pl-3'

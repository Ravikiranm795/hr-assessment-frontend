import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'
import { richText } from './html'

interface RichTextEditorProps {
  /** Initial HTML. The editor owns its content afterwards (remount with a new `key` to reset). */
  value: string
  onChange: (html: string) => void
  label: string
  disabled?: boolean
  /** No toolbar, one or two lines: used for answer options. */
  compact?: boolean
  mono?: boolean
  invalid?: boolean
  hideLabel?: boolean
  error?: string
}

/**
 * Tiptap editor producing HTML (module-local; promotion candidate). The backend sanitizes on save and
 * every render goes through DOMPurify, so the HTML produced here is never trusted blindly.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  disabled,
  compact,
  mono,
  invalid,
  hideLabel,
  error,
}: RichTextEditorProps) {
  const { t } = useTranslation()
  const labelId = useId()
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, blockquote: false, horizontalRule: false })],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        class: cn('outline-none', compact ? 'min-h-6' : 'min-h-20', mono && 'font-mono'),
      },
    },
    onUpdate: ({ editor: ed }) => onChangeRef.current(ed.isEmpty ? '' : ed.getHTML()),
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed?.isActive('bold') ?? false,
      italic: ed?.isActive('italic') ?? false,
      bullet: ed?.isActive('bulletList') ?? false,
      ordered: ed?.isActive('orderedList') ?? false,
      code: ed?.isActive('codeBlock') ?? false,
    }),
  })

  const tools = editor
    ? [
        { key: 'bold', label: t('assessments.editor.bold'), on: active?.bold, run: () => editor.chain().focus().toggleBold().run(), face: 'B' },
        { key: 'italic', label: t('assessments.editor.italic'), on: active?.italic, run: () => editor.chain().focus().toggleItalic().run(), face: 'I' },
        { key: 'bullet', label: t('assessments.editor.bulletList'), on: active?.bullet, run: () => editor.chain().focus().toggleBulletList().run(), face: '•' },
        { key: 'ordered', label: t('assessments.editor.orderedList'), on: active?.ordered, run: () => editor.chain().focus().toggleOrderedList().run(), face: '1.' },
        { key: 'code', label: t('assessments.editor.codeBlock'), on: active?.code, run: () => editor.chain().focus().toggleCodeBlock().run(), face: '</>' },
      ]
    : []

  return (
    <div className="space-y-1.5">
      <span id={labelId} className={cn('block text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div
        className={cn(
          'rounded-(--radius) border bg-surface text-sm focus-within:outline-2 focus-within:outline-primary',
          invalid || error ? 'border-error' : 'border-border',
          disabled && 'bg-bg',
        )}
      >
        {!compact && !disabled && (
          <div className="flex gap-1 border-b border-border p-1" role="toolbar" aria-label={t('assessments.editor.toolbar')}>
            {tools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                aria-label={tool.label}
                aria-pressed={tool.on}
                onClick={tool.run}
                className={cn(
                  'h-7 min-w-7 rounded px-1.5 text-xs font-semibold hover:bg-bg',
                  tool.on && 'bg-primary/10 text-primary',
                )}
              >
                {tool.face}
              </button>
            ))}
          </div>
        )}
        <EditorContent editor={editor} className={cn('px-3 py-2', richText)} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}

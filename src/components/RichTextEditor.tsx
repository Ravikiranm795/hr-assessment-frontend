import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'

const PROSE =
  '[&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-(--radius) [&_pre]:bg-bg [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm'

interface Props {
  /** Initial HTML. The editor owns its content afterwards (remount with a new `key` to reset). */
  value: string
  onChange: (html: string) => void
  label: string
  disabled?: boolean
  error?: string
  /** Minimum height of the writing area. */
  minHeightClass?: string
}

/**
 * Tiptap editor that produces HTML (policy documents, question prompts). The backend sanitizes on save
 * and every render goes through DOMPurify (`Html`), so this output is never trusted blindly.
 */
export function RichTextEditor({ value, onChange, label, disabled, error, minHeightClass = 'min-h-40' }: Props) {
  const { t } = useTranslation()
  const labelId = useId()
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [StarterKit.configure({ horizontalRule: false })],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': labelId, class: cn('outline-none', minHeightClass) },
    },
    onUpdate: ({ editor: ed }) => onChangeRef.current(ed.isEmpty ? '' : ed.getHTML()),
  })

  useEffect(() => {
    // `false`: toggling editability must not emit an update (it would mark the content as edited).
    editor?.setEditable(!disabled, false)
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
        { key: 'bold', label: t('common.editor.bold'), on: active?.bold, run: () => editor.chain().focus().toggleBold().run(), face: 'B' },
        { key: 'italic', label: t('common.editor.italic'), on: active?.italic, run: () => editor.chain().focus().toggleItalic().run(), face: 'I' },
        { key: 'bullet', label: t('common.editor.bulletList'), on: active?.bullet, run: () => editor.chain().focus().toggleBulletList().run(), face: '•' },
        { key: 'ordered', label: t('common.editor.orderedList'), on: active?.ordered, run: () => editor.chain().focus().toggleOrderedList().run(), face: '1.' },
        { key: 'code', label: t('common.editor.codeBlock'), on: active?.code, run: () => editor.chain().focus().toggleCodeBlock().run(), face: '</>' },
      ]
    : []

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block text-sm font-medium">
        {label}
      </span>
      <div className={cn('rounded-(--radius) border bg-surface text-sm focus-within:outline-2 focus-within:outline-primary', error ? 'border-error' : 'border-border', disabled && 'bg-bg')}>
        {!disabled && (
          <div className="flex gap-1 border-b border-border p-1" role="toolbar" aria-label={t('common.editor.toolbar')}>
            {tools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                aria-label={tool.label}
                aria-pressed={tool.on}
                onClick={tool.run}
                className={cn('h-7 min-w-7 rounded px-1.5 text-xs font-semibold hover:bg-bg', tool.on && 'bg-primary/10 text-primary')}
              >
                {tool.face}
              </button>
            ))}
          </div>
        )}
        <EditorContent editor={editor} className={cn('px-3 py-2', PROSE)} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, defaultHighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { Annotation, Compartment, EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils'
import { loadLanguage } from './languages'
import { DEFAULT_EDITOR_HEIGHT, DEFAULT_TAB_SIZE, type CodeEditorProps } from './types'

// Marks changes that came from the `value` prop, so they are not reported back through onChange.
const FromProps = Annotation.define<boolean>()

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '0.875rem', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-muted)',
    borderRight: '1px solid var(--color-border)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' },
  '.cm-cursor': { borderLeftColor: 'var(--color-text)' },
  '&.cm-focused': { outline: '2px solid var(--color-primary)', outlineOffset: '-2px' },
})

const tabKeys = [keymap.of([indentWithTab])]

/**
 * The code editor (CodeMirror 6). Plain editing only: syntax colours, indentation, line numbers, undo.
 * No autocomplete, no running, no compiling. Always load it through `CodeEditor` (lazy), never import this file directly.
 */
export default function CodeEditorCore({
  value,
  onChange,
  language,
  label,
  readOnly = false,
  tabSize = DEFAULT_TAB_SIZE,
  height = DEFAULT_EDITOR_HEIGHT,
  className,
}: CodeEditorProps) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const [slots] = useState(() => ({
    language: new Compartment(),
    meta: new Compartment(),
    indent: new Compartment(),
    tab: new Compartment(),
  }))

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Mount once. Props that can change later (value, language, readOnly, label, tabSize) have their own effects below.
  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          theme,
          slots.language.of([]),
          slots.meta.of([]),
          slots.indent.of([]),
          // Tab indents. Esc releases the Tab key so keyboard users can leave the editor; blur turns it back on.
          slots.tab.of(tabKeys),
          keymap.of([
            {
              key: 'Escape',
              run: (v) => {
                v.dispatch({ effects: slots.tab.reconfigure([]) })
                return true
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.domEventHandlers({
            blur: (_event, v) => {
              v.dispatch({ effects: slots.tab.reconfigure(tabKeys) })
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || update.transactions.some((tr) => tr.annotation(FromProps))) return
            onChangeRef.current?.(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // `value` seeds the first document only; later changes go through the sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  useEffect(() => {
    const editor = view.current
    if (!editor || editor.state.doc.toString() === value) return
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      annotations: FromProps.of(true),
    })
  }, [value])

  useEffect(() => {
    let stale = false
    void loadLanguage(language).then((extension) => {
      if (!stale) view.current?.dispatch({ effects: slots.language.reconfigure(extension) })
    })
    return () => {
      stale = true
    }
  }, [language, slots])

  useEffect(() => {
    view.current?.dispatch({
      effects: slots.meta.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true' }),
      ]),
    })
  }, [readOnly, label, slots])

  useEffect(() => {
    view.current?.dispatch({
      effects: slots.indent.reconfigure([EditorState.tabSize.of(tabSize), indentUnit.of(' '.repeat(tabSize))]),
    })
  }, [tabSize, slots])

  return (
    <div className={className}>
      <div ref={host} style={{ height }} className={cn('overflow-hidden rounded-(--radius) border border-border')} />
      {!readOnly && <p className="mt-1.5 text-xs text-muted">{t('codeEditor.tabHint')}</p>}
    </div>
  )
}

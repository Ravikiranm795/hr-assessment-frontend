import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/Spinner'
import { DEFAULT_EDITOR_HEIGHT, type CodeEditorProps } from './types'

// The editor engine is a separate download: MCQ-only exams and staff pages that never show code do not pay for it.
const CodeEditorCore = lazy(() => import('./CodeEditorCore'))

/** Use this everywhere. Shows a spinner of the same height while the editor loads, so the page does not jump. */
export function CodeEditor(props: CodeEditorProps) {
  const { t } = useTranslation()
  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height ?? DEFAULT_EDITOR_HEIGHT }}
          className="flex items-center justify-center rounded-(--radius) border border-border bg-surface"
        >
          <Spinner label={t('common.loading')} />
        </div>
      }
    >
      <CodeEditorCore {...props} />
    </Suspense>
  )
}

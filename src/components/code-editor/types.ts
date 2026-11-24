import type { CodeLanguage } from './languages'

export interface CodeEditorProps {
  /** The code. The editor is controlled: a new value replaces the document if it differs. */
  value: string
  onChange?: (value: string) => void
  language: CodeLanguage
  /** Accessible name of the editing area (already translated). */
  label: string
  readOnly?: boolean
  /** Spaces per indent level. */
  tabSize?: number
  /** Any CSS height; the editor scrolls inside it. */
  height?: string
  className?: string
}

export const DEFAULT_EDITOR_HEIGHT = '24rem'
export const DEFAULT_TAB_SIZE = 4

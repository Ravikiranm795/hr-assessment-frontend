import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { errorText } from '@/core/api/errors'
import { cn } from '@/core/utils'

type Kind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: Kind
  text: string
}
interface ToastApi {
  success: (text: string) => void
  info: (text: string) => void
  /** Pass the thrown value; the text comes from its `message_key`. */
  error: (error: unknown) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: Kind, text: string) => {
    const id = nextId++
    setItems((list) => [...list, { id, kind, text }])
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), kind === 'error' ? 8000 : 4000)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push('success', text),
      info: (text) => push('info', text),
      error: (error) => push('error', errorText(error)),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {items.map((i) => (
          <div
            key={i.id}
            role={i.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-start justify-between gap-3 rounded-(--radius) border bg-surface p-3 text-sm shadow-card',
              i.kind === 'error' && 'border-error/40',
              i.kind === 'success' && 'border-success/40',
              i.kind === 'info' && 'border-border',
            )}
          >
            <span>{i.text}</span>
            <button
              type="button"
              className="text-muted hover:text-text"
              aria-label={t('common.close')}
              onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

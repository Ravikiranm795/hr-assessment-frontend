import { useId } from 'react'
import { cn } from '@/core/utils'
import { CODE_LANGUAGES, type CodeLanguage } from './languages'

interface LanguageSelectProps {
  value: CodeLanguage
  onChange: (language: CodeLanguage) => void
  /** Limit the choices (for example the languages HR allowed for one question). Defaults to all. */
  allowed?: readonly CodeLanguage[]
  /** Visible label (already translated). */
  label: string
  disabled?: boolean
  className?: string
}

/** Native select: keyboard and screen-reader friendly, and nothing extra to download. */
export function LanguageSelect({ value, onChange, allowed, label, disabled, className }: LanguageSelectProps) {
  const id = useId()
  const options = allowed ? CODE_LANGUAGES.filter((l) => allowed.includes(l.id)) : CODE_LANGUAGES
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as CodeLanguage)}
        className="rounded-(--radius) border border-border bg-surface px-3 py-1.5 text-sm"
      >
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}

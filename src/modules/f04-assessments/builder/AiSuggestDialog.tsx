import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { Textarea } from '@/components/Textarea'
import { errorText } from '@/core/api/errors'
import { assessmentsApi, type AiOptions, type QuestionGenRequest, type QuestionOut, type SuggestedQuestion } from '../api'
import { Banner, SelectField } from '../ui/controls'
import { SafeHtml } from '../ui/SafeHtml'
import { suggestionToIn } from './model'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  assessmentId: string
  versionId: string
  options: AiOptions
  onAdded: (items: QuestionOut[]) => void
}

const LEVELS = ['entry', 'junior', 'mid', 'senior', 'lead']
const list = (value: string) =>
  value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean)

/** AI suggestions: form -> long-running generate -> tick-list -> bulk add (spec F4). */
export function AiSuggestDialog({ open, onOpenChange, ...rest }: Props) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('assessments.ai.title')} description={t('assessments.ai.body')} wide>
      <AiBody onClose={() => onOpenChange(false)} {...rest} />
    </Modal>
  )
}

function AiBody({ onClose, assessmentId, versionId, options, onAdded }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const { t } = useTranslation()
  const [roleTitle, setRoleTitle] = useState('')
  const [jd, setJd] = useState('')
  const [level, setLevel] = useState('mid')
  const [skills, setSkills] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [difficulty, setDifficulty] = useState<Record<string, string>>({})
  const [typeMix, setTypeMix] = useState<Record<string, string>>({})
  const [count, setCount] = useState(String(options.defaults.num_questions ?? 10))
  const [domain, setDomain] = useState('')
  const [avoid, setAvoid] = useState('')
  const [explain, setExplain] = useState('')
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<SuggestedQuestion[] | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  const minQ = options.defaults.min_questions ?? 10
  const maxQ = options.defaults.max_questions ?? 50

  const generate = useMutation({
    mutationFn: (body: QuestionGenRequest) => {
      abortRef.current = new AbortController()
      return assessmentsApi.aiGenerate(body, abortRef.current.signal)
    },
    onSuccess: (res) => {
      setSuggestions(res.suggestions)
      setTicked(new Set(res.suggestions.map((s) => s.temp_id)))
    },
  })
  const add = useMutation({
    mutationFn: () =>
      assessmentsApi.bulk(
        assessmentId,
        versionId,
        (suggestions ?? []).filter((s) => ticked.has(s.temp_id)).map(suggestionToIn),
      ),
    onSuccess: (res) => {
      onAdded(res.items)
      onClose()
    },
  })

  const mix = (values: Record<string, string>) => {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(values)) if (Number(v) > 0) out[k] = Number(v)
    return Object.keys(out).length > 0 ? out : null
  }

  function submit() {
    const need = new Set<string>()
    if (!roleTitle.trim()) need.add('role')
    if (!jd.trim()) need.add('jd')
    if (list(skills).length === 0) need.add('skills')
    const n = Number(count)
    if (!Number.isInteger(n) || n < minQ || n > maxQ) need.add('count')
    setMissing(need)
    if (need.size > 0) {
      if (need.has('count') && need.size === 1) setShowMore(true)
      return
    }
    generate.mutate({
      role_title: roleTitle.trim(),
      job_description: jd.trim(),
      experience_level: level,
      key_skills: list(skills),
      difficulty_mix: mix(difficulty),
      question_type_mix: mix(typeMix),
      num_questions: n,
      domain: domain.trim() || null,
      topics_to_avoid: list(avoid).length > 0 ? list(avoid) : null,
      role_explanation: explain.trim() || null,
    })
  }

  if (generate.isPending) {
    return (
      <div className="space-y-4 py-6 text-center" data-testid="ai-loading">
        <Spinner label={t('assessments.ai.generating')} className="justify-center" />
        <p className="text-sm text-muted">{t('assessments.ai.generatingHint')}</p>
        <Button variant="outline" onClick={() => abortRef.current?.abort()}>
          {t('common.cancel')}
        </Button>
      </div>
    )
  }

  if (suggestions) {
    const some = ticked.size > 0
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('assessments.ai.resultsHint', { count: suggestions.length })}</p>
        {add.error ? <Banner tone="error">{errorText(add.error)}</Banner> : null}
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto" aria-label={t('assessments.ai.resultsLabel')}>
          {suggestions.map((s) => (
            <li key={s.temp_id} className="rounded-(--radius) border border-border p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ticked.has(s.temp_id)}
                  onChange={(e) =>
                    setTicked((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(s.temp_id)
                      else next.delete(s.temp_id)
                      return next
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {t(`assessments.question_type.${s.type}`)} · {t(`assessments.ai.difficulty.${s.difficulty}`)} · {t('assessments.preview.marks', { marks: s.marks })}
                  </p>
                  <SafeHtml html={s.prompt_html} />
                </div>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('assessments.ai.discard')}
          </Button>
          <Button disabled={!some} loading={add.isPending} onClick={() => add.mutate()}>
            {t('assessments.ai.addSelected', { count: ticked.size })}
          </Button>
        </div>
      </div>
    )
  }

  const req = t('fieldErrors.required')
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {generate.error && !(generate.error instanceof DOMException) ? <Banner tone="error">{errorText(generate.error)}</Banner> : null}
      <Field label={t('assessments.ai.field.role')} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} error={missing.has('role') ? req : undefined} />
      <Textarea
        label={t('assessments.ai.field.jd')}
        value={jd}
        rows={5}
        maxLength={options.limits.max_jd_chars}
        onChange={(e) => setJd(e.target.value)}
        error={missing.has('jd') ? req : undefined}
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField label={t('assessments.ai.field.level')} value={level} onChange={(e) => setLevel(e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`assessments.ai.level.${l}`)}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('assessments.ai.field.skills')}
          hint={t('assessments.ai.field.skillsHint')}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          error={missing.has('skills') ? req : undefined}
        />
      </div>

      <button type="button" className="text-sm font-medium text-primary" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
        {t(showMore ? 'assessments.ai.lessOptions' : 'assessments.ai.moreOptions')}
      </button>
      {showMore && (
        <div className="space-y-4 rounded-(--radius) border border-border p-4">
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('assessments.ai.field.difficultyMix')}</legend>
            <div className="grid grid-cols-3 gap-3">
              {options.difficulties.map((d) => (
                <Field
                  key={d}
                  type="number"
                  min={0}
                  label={t(`assessments.ai.difficulty.${d}`)}
                  value={difficulty[d] ?? ''}
                  onChange={(e) => setDifficulty({ ...difficulty, [d]: e.target.value })}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('assessments.ai.field.typeMix')}</legend>
            <div className="grid grid-cols-3 gap-3">
              {options.question_types.map((qt) => (
                <Field
                  key={qt.key}
                  type="number"
                  min={0}
                  label={t(`assessments.question_type.${qt.key}`)}
                  value={typeMix[qt.key] ?? ''}
                  onChange={(e) => setTypeMix({ ...typeMix, [qt.key]: e.target.value })}
                />
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <Field
              type="number"
              label={t('assessments.ai.field.count')}
              hint={t('assessments.ai.field.countHint', { min: minQ, max: maxQ })}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              error={missing.has('count') ? t('assessments.ai.field.countHint', { min: minQ, max: maxQ }) : undefined}
            />
            <Field label={t('assessments.ai.field.domain')} value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <Field label={t('assessments.ai.field.avoid')} hint={t('assessments.ai.field.skillsHint')} value={avoid} onChange={(e) => setAvoid(e.target.value)} />
          <Textarea label={t('assessments.ai.field.explain')} value={explain} onChange={(e) => setExplain(e.target.value)} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('assessments.ai.generate')}</Button>
      </div>
    </form>
  )
}

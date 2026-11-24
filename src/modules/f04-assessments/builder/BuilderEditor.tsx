import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/Field'
import { Textarea } from '@/components/Textarea'
import { useToast } from '@/components/Toast'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { assessmentsApi, keys, QUESTION_TYPES, type AssessmentDetail, type QuestionType, type VersionOut } from '../api'
import { PreviewDialog } from '../preview/PreviewDialog'
import { Banner } from '../ui/controls'
import { Menu } from '../ui/Menu'
import { RichTextEditor } from '../ui/RichTextEditor'
import { AiSuggestDialog } from './AiSuggestDialog'
import { newQuestion, questionIssues, type Settings } from './model'
import { PublishProblemsDialog, type PublishProblem } from './PublishDialog'
import { QuestionList } from './QuestionList'
import { useBuilder } from './useBuilder'
import { MAX_VERSIONS, VersionBar } from './VersionBar'

interface Props {
  assessment: AssessmentDetail
  version: VersionOut
  /** Owner or org admin. */
  canEdit: boolean
}

/** The builder for one version (spec F4). Remounted whenever the version or its status changes. */
export function BuilderEditor({ assessment, version, canEdit }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasFlag } = useAuth()

  const published = version.status === 'published'
  const editable = canEdit && !published
  const readOnly = !editable

  const [immutable, setImmutable] = useState(false)
  const onImmutable = useCallback(() => setImmutable(true), [])
  const { state, getState, dispatch, dirty, saving, save, statusText } = useBuilder({ assessment, version, editable, onImmutable })

  const [previewOpen, setPreviewOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [problems, setProblems] = useState<PublishProblem[] | null>(null)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmVersion, setConfirmVersion] = useState(false)
  const [versionProblem, setVersionProblem] = useState<{ code: string; text: string } | null>(null)

  // Unsaved changes: warn on in-app navigation and on closing the tab (spec 8.11).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const aiAllowed = editable && hasFlag('ai_question_builder')
  const aiOptions = useQuery({
    queryKey: keys.aiOptions,
    queryFn: () => assessmentsApi.aiOptions(),
    enabled: aiAllowed,
    staleTime: 5 * 60_000,
  })
  const showAi = aiAllowed && aiOptions.data?.configured === true

  const jump = (key: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(`question-${key}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLElement>('[role="textbox"]')?.focus()
    }, 50)
  }

  // Coding questions need the `code_assessment` flag (backend answers FEATURE_DISABLED otherwise).
  const offeredTypes: QuestionType[] = hasFlag('code_assessment') ? [...QUESTION_TYPES, 'code_write'] : QUESTION_TYPES

  const addQuestion = (type: QuestionType) => {
    const q = newQuestion(type)
    dispatch({ type: 'add', question: q })
    jump(q.key)
  }

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: keys.all })

  const createVersion = useMutation({
    mutationFn: () => assessmentsApi.createVersion(assessment.id),
    onSuccess: async (created) => {
      setConfirmVersion(false)
      setVersionProblem(null)
      await refreshAll()
      toast.success(t('assessments.version.created', { n: created.version_no }))
      navigate(`/assessments/${assessment.id}/versions/${created.id}`)
    },
    onError: (error) => {
      setConfirmVersion(false)
      if (error instanceof ApiError) setVersionProblem({ code: error.code, text: errorText(error) })
      else toast.error(error)
    },
  })

  const publish = useMutation({
    mutationFn: () => assessmentsApi.publish(assessment.id, version.id),
    onSuccess: async () => {
      setConfirmPublish(false)
      toast.success(t('assessments.publish.done', { n: version.version_no }))
      await refreshAll()
    },
    onError: (error) => {
      setConfirmPublish(false)
      const issues = error instanceof ApiError && Array.isArray(error.details.issues) ? (error.details.issues as { question_id: string | null; position: number | null; code: string }[]) : null
      if (issues && issues.length > 0) {
        setProblems(
          issues.map((i) => ({
            questionKey: getState().questions.find((q) => q.id === i.question_id)?.key ?? null,
            position: i.position,
            code: i.code,
          })),
        )
      } else if (error instanceof ApiError && error.is('ASSESSMENT_IMMUTABLE')) setImmutable(true)
      else toast.error(error)
    },
  })

  /** Local mirror of the backend publish rules, so problems show before anything is sent. */
  const localProblems = (): PublishProblem[] => {
    const qs = getState().questions
    if (qs.length === 0) return [{ questionKey: null, position: null, code: 'no_questions' }]
    return qs.flatMap((q, i) => questionIssues(q).map((code) => ({ questionKey: q.key, position: i + 1, code })))
  }

  async function onPublish() {
    await save('manual')
    const found = localProblems()
    if (found.length > 0) setProblems(found)
    else setConfirmPublish(true)
  }

  async function onPreview() {
    const ok = await save('manual')
    if (!ok) toast.info(t('assessments.builder.previewStale'))
    setPreviewOpen(true)
  }

  const totalMarks = state.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)
  const settingsError = (field: 'title' | 'duration' | 'passMark') => {
    const code = state.settingsErrors[field]
    if (!code) return undefined
    if (code === 'required') return t('fieldErrors.required')
    if (code === 'range') return t(field === 'duration' ? 'assessments.settings.durationRange' : 'assessments.settings.passMarkRange')
    return code
  }
  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings', patch })
  const s = state.settings

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <Link to="/assessments" className="text-sm text-primary hover:underline">
          {t('assessments.builder.back')}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{s.title || t('assessments.builder.untitled')}</h1>
          <p className="text-sm text-muted" aria-live="polite" data-testid="save-status">
            {readOnly ? t(published ? 'assessments.builder.status.published' : 'assessments.builder.status.readOnly') : statusText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showAi && (
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              {t('assessments.ai.open')}
            </Button>
          )}
          <Button variant="outline" onClick={() => void onPreview()}>
            {t('assessments.builder.preview')}
          </Button>
          {editable && (
            <>
              <Button variant="outline" loading={saving} onClick={() => void save('manual').then((ok) => ok && toast.success(t('assessments.builder.saved')))}>
                {t('assessments.builder.saveDraft')}
              </Button>
              <Button loading={publish.isPending} onClick={() => void onPublish()}>
                {t('assessments.builder.publish')}
              </Button>
            </>
          )}
        </div>
      </header>

      {!canEdit && <Banner tone="warning">{t('assessments.builder.notOwner')}</Banner>}
      {immutable && (
        <Banner
          tone="error"
          action={
            <Button size="sm" variant="outline" onClick={() => void refreshAll().then(() => setImmutable(false))}>
              {t('assessments.builder.reload')}
            </Button>
          }
        >
          {t('errors.assessment.immutable')}
        </Banner>
      )}

      <VersionBar
        assessment={assessment}
        version={version}
        canEdit={canEdit}
        creating={createVersion.isPending}
        problem={versionProblem}
        onCreate={() => (assessment.version_count >= MAX_VERSIONS ? setConfirmVersion(true) : createVersion.mutate())}
      />

      <section aria-label={t('assessments.settings.title')} className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold">{t('assessments.settings.title')}</h2>
        <Field label={t('assessments.field.title')} value={s.title} disabled={readOnly} error={settingsError('title')} onChange={(e) => set({ title: e.target.value })} />
        <Textarea label={t('assessments.field.description')} value={s.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Field
            type="number"
            label={t('assessments.settings.duration')}
            hint={t('assessments.settings.durationHint')}
            value={s.duration}
            disabled={readOnly}
            error={settingsError('duration')}
            onChange={(e) => set({ duration: e.target.value })}
          />
          <Field
            type="number"
            label={t('assessments.settings.passMark')}
            hint={t('assessments.settings.passMarkHint')}
            value={s.passMark}
            disabled={readOnly}
            error={settingsError('passMark')}
            onChange={(e) => set({ passMark: e.target.value })}
          />
        </div>
        <RichTextEditor
          label={t('assessments.settings.instructions')}
          value={s.instructions_html}
          disabled={readOnly}
          onChange={(html) => set({ instructions_html: html })}
        />
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.shuffle_questions} disabled={readOnly} onChange={(e) => set({ shuffle_questions: e.target.checked })} />
            {t('assessments.settings.shuffleQuestions')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.shuffle_options} disabled={readOnly} onChange={(e) => set({ shuffle_options: e.target.checked })} />
            {t('assessments.settings.shuffleOptions')}
          </label>
        </div>
      </section>

      <section aria-label={t('assessments.questions.title')} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t('assessments.questions.title')}</h2>
            <p className="text-sm text-muted" data-testid="questions-summary">
              {t('assessments.questions.summary', { count: state.questions.length, marks: totalMarks })}
            </p>
          </div>
          {editable && (
            <Menu
              trigger={<Button>{t('assessments.questions.add')}</Button>}
              items={offeredTypes.map((type) => ({ key: type, label: t(`assessments.question_type.${type}`), onSelect: () => addQuestion(type) }))}
            />
          )}
        </div>
        {state.questions.length === 0 ? (
          <div className="rounded-(--radius) border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
            {t(editable ? 'assessments.questions.empty' : 'assessments.questions.emptyReadOnly')}
          </div>
        ) : (
          <QuestionList
            questions={state.questions}
            readOnly={readOnly}
            showProblems={state.showProblems}
            aiScoring={hasFlag('ai_scoring')}
            onPatch={(key, patch) => dispatch({ type: 'patch', key, patch })}
            onRemove={(key) => dispatch({ type: 'remove', key })}
            onMove={(from, to) => dispatch({ type: 'move', from, to })}
          />
        )}
      </section>

      <section aria-label={t('assessments.branding.title')} className="space-y-4 rounded-(--radius) border border-border bg-surface p-5 shadow-card">
        <div>
          <h2 className="text-lg font-semibold">{t('assessments.branding.title')}</h2>
          <p className="text-sm text-muted">{t('assessments.branding.body')}</p>
        </div>
        <Field label={t('assessments.branding.company')} value={s.company_name} disabled={readOnly} onChange={(e) => set({ company_name: e.target.value })} />
        <p className="text-xs text-muted">{t('assessments.branding.logoNote')}</p>
        <RichTextEditor label={t('assessments.branding.footer')} value={s.footer_html} disabled={readOnly} onChange={(html) => set({ footer_html: html })} />
      </section>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} assessmentId={assessment.id} versionId={version.id} />
      {showAi && aiOptions.data && (
        <AiSuggestDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          assessmentId={assessment.id}
          versionId={version.id}
          options={aiOptions.data}
          onAdded={(items) => {
            dispatch({ type: 'append', items })
            toast.success(t('assessments.ai.added', { count: items.length }))
          }}
        />
      )}
      <PublishProblemsDialog open={problems !== null} onOpenChange={(open) => !open && setProblems(null)} problems={problems ?? []} onJump={jump} />
      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={t('assessments.publish.confirmTitle', { n: version.version_no })}
        body={t('assessments.publish.confirmBody')}
        confirmLabel={t('assessments.builder.publish')}
        loading={publish.isPending}
        onConfirm={() => publish.mutate()}
      />
      <ConfirmDialog
        open={confirmVersion}
        onOpenChange={setConfirmVersion}
        title={t('assessments.version.purgeTitle')}
        body={t('assessments.version.purgeBody', { max: MAX_VERSIONS })}
        confirmLabel={t('assessments.version.create')}
        loading={createVersion.isPending}
        onConfirm={() => createVersion.mutate()}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title={t('assessments.leave.title')}
        body={t('assessments.leave.body')}
        confirmLabel={t('assessments.leave.confirm')}
        danger
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  )
}

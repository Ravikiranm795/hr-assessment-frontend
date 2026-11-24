import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Spinner } from '@/components/Spinner'
import { examApi } from '../examApi'
import { examErrorText, isAlreadySubmitted, isSessionLost, isTerminal } from '../errors'
import { ExamLayout } from '../ExamLayout'
import { HelpPanel } from '../HelpPanel'
import { CameraVideo, useCamera } from '../proctor/camera'
import { HEARTBEAT_FAIL_LIMIT, getProctorSessionId } from '../proctor/heartbeat'
import { useFocusOnMount } from '../Screens'
import type { AnswerValue, ExamQuestion, ExamState } from '../types'
import { AnswerSync, storageKey } from './answerSync'
import { SectionedSurface } from './SectionedSurface'
import { Palette } from './Palette'
import { QuestionView, isAnswered, type AnswerKind } from './QuestionView'
import { formatClock, useServerClock } from './useServerClock'
import { useProctoring } from './useProctoring'

const HEARTBEAT_MS = 10_000
/** After this many fullscreen exits the banner turns into a stronger (still non-blocking) warning. */
const FULLSCREEN_STRONG_AFTER = 3
const ANNOUNCE_AT = [600, 300, 60]
const SUBMIT_TRIES = 4

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface ExamRunnerProps {
  state: ExamState
  inviteToken: string
  /** The page was loaded while the exam was already running (a reload). */
  resumed: boolean
  onSubmitted: () => void
  onFatal: (error: unknown) => void
  refreshState: () => void
}

export function ExamRunner(props: ExamRunnerProps) {
  const [confirmed, setConfirmed] = useState(!props.resumed)
  const camera = useCamera()
  const heading = useFocusOnMount<HTMLHeadingElement>()
  const { t } = useTranslation()

  if (confirmed) return props.state.sectioned ? <SectionedSurface {...props} /> : <ExamSurface {...props} />

  // After a reload the browser needs a click to go fullscreen and to bring the camera back.
  const resume = () => {
    if (document.fullscreenEnabled) void document.documentElement.requestFullscreen().catch(() => undefined)
    if (props.state.camera_required) void camera.request()
    setConfirmed(true)
  }
  return (
    <ExamLayout state={props.state}>
      <div className="space-y-4 rounded-(--radius) border border-border bg-surface p-8">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t('exam.resume.title')}
        </h1>
        <p className="text-muted">{t('exam.resume.body')}</p>
        <Button size="lg" onClick={resume}>
          {t('exam.resume.continue')}
        </Button>
      </div>
    </ExamLayout>
  )
}

function ExamSurface({ state, inviteToken, resumed, onSubmitted, onFatal, refreshState }: ExamRunnerProps) {
  const { t } = useTranslation()
  const camera = useCamera()
  const cameraRequired = state.camera_required
  const clock = useServerClock(state.remaining_seconds)
  const proctoring = useProctoring({
    active: true,
    cameraRequired,
    snapshotIntervalSeconds: state.snapshot_interval_seconds,
    resumed,
  })

  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [current, setCurrent] = useState(0)
  const [pending, setPending] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewOn, setPreviewOn] = useState(false) // hidden by default (F-08)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<'save' | 'submit' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement)
  const [heartbeatLost, setHeartbeatLost] = useState(false)

  const sync = useRef<AnswerSync | null>(null)
  const submittingRef = useRef(false)
  const finalizeRef = useRef<(auto: boolean) => Promise<void>>(() => Promise.resolve())
  const moved = useRef(false)

  const { left, sync: syncClock } = clock
  const { finish } = proctoring
  const cameraStop = camera.stop

  // Submit: flush answers first, then send; repeat-safe on the server. Time running out submits for the candidate.
  const finalize = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setSubmitting(true)
      setSubmitError(null)
      setConfirmOpen(false)
      const saver = sync.current
      const saved = saver ? await saver.flush() : true
      if (!saved && !auto) {
        submittingRef.current = false
        setSubmitting(false)
        setSubmitError('save')
        return
      }
      await finish()
      for (let attempt = 0; ; ) {
        try {
          await examApi.submit()
          break
        } catch (error) {
          if (isAlreadySubmitted(error)) break
          if (isTerminal(error)) return onFatal(error)
          attempt += 1
          if (isSessionLost(error)) {
            try {
              await examApi.reopen()
              continue
            } catch {
              // fall through to the normal retry
            }
          }
          if (!auto && attempt >= SUBMIT_TRIES) {
            submittingRef.current = false
            setSubmitting(false)
            setSubmitError('submit')
            return
          }
          await sleep(Math.min(30_000, 1000 * 2 ** attempt))
        }
      }
      saver?.dispose()
      await saver?.clearStore()
      cameraStop()
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      onSubmitted()
    },
    [finish, cameraStop, onSubmitted, onFatal],
  )
  useEffect(() => {
    finalizeRef.current = finalize
  }, [finalize])

  // Load the questions and the saved answers; unsent answers from a previous page load win (they are newer).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saver = new AnswerSync(await storageKey(inviteToken), {
        onRemaining: syncClock,
        onTimeOver: () => void finalizeRef.current(true),
        onSubmitted,
        onFatal,
        onPending: setPending,
      })
      sync.current = saver
      try {
        const out = await examApi.questions()
        const restored = await saver.restore()
        if (cancelled) return
        syncClock(out.remaining_seconds)
        setAnswers({ ...out.answers, ...restored })
        setQuestions([...out.questions].sort((a, b) => a.position - b.position))
      } catch (error) {
        if (cancelled) return
        if (isAlreadySubmitted(error)) return onSubmitted()
        if (isTerminal(error)) return onFatal(error)
        setLoadError(examErrorText(error))
      }
    })()
    return () => {
      cancelled = true
      sync.current?.dispose()
      sync.current = null
    }
  }, [inviteToken, syncClock, onSubmitted, onFatal])

  // The server clock: re-sync on every heartbeat, and when the tab or the network comes back.
  const loaded = questions !== null
  useEffect(() => {
    if (!loaded) return
    let fails = 0
    const beat = async () => {
      try {
        const out = await examApi.heartbeat({
          session_id: getProctorSessionId(),
          visible: document.visibilityState === 'visible',
        })
        fails = 0
        setHeartbeatLost(false)
        syncClock(out.remaining_seconds)
        if (out.status === 'submitted') onSubmitted()
        else if (out.time_over) void finalizeRef.current(true)
      } catch (error) {
        fails += 1
        if (fails >= HEARTBEAT_FAIL_LIMIT && navigator.onLine) setHeartbeatLost(true)
        if (isAlreadySubmitted(error)) onSubmitted()
        else if (isTerminal(error)) onFatal(error)
        else if (isSessionLost(error)) await examApi.reopen().catch(() => undefined)
      }
    }
    const onVisible = () => void beat()
    const id = setInterval(() => void beat(), HEARTBEAT_MS)
    window.addEventListener('online', beat)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', beat)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loaded, syncClock, onSubmitted, onFatal])

  useEffect(() => {
    if (loaded && left === 0) void finalizeRef.current(true)
  }, [loaded, left])

  useEffect(() => {
    if (left !== null && ANNOUNCE_AT.includes(left)) setAnnouncement(t('exam.timer.announce', { minutes: left / 60 }))
  }, [left, t])

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!moved.current || !questions) return
    document.getElementById(`question-${questions[current]?.id}`)?.focus()
  }, [current, questions])

  const setAnswer = (question: ExamQuestion, value: AnswerValue, kind: AnswerKind) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
    sync.current?.set(question.id, value, kind)
  }
  const go = (index: number) => {
    moved.current = true
    setCurrent(index)
  }

  const answered = useMemo(
    () => (questions ?? []).map((q) => isAnswered(q, answers[q.id])),
    [questions, answers],
  )
  const answeredCount = answered.filter(Boolean).length
  const needsFullscreen = document.fullscreenEnabled && !fullscreen && !submitting
  const cameraProblem = cameraRequired && camera.status !== 'active' && camera.status !== 'starting'

  if (loadError) {
    return (
      <ExamLayout state={state}>
        <div role="alert" className="space-y-4">
          <p>{loadError}</p>
          <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
        </div>
      </ExamLayout>
    )
  }
  if (!questions || left === null) {
    return (
      <ExamLayout state={state}>
        <Spinner label={t('exam.loading')} />
      </ExamLayout>
    )
  }

  const question = questions[current]
  return (
    <ExamLayout state={state} narrow={false}>
      <div className="select-none print:hidden [&_input]:select-text [&_textarea]:select-text">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{t('exam.timer.label')}</span>
            <span role="timer" aria-live="off" className="font-mono text-xl font-semibold tabular-nums">
              {formatClock(left)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cameraRequired && (
              <Button variant="outline" size="sm" aria-pressed={previewOn} onClick={() => setPreviewOn((on) => !on)}>
                {t(previewOn ? 'exam.camera.hide' : 'exam.camera.show')}
              </Button>
            )}
            <HelpPanel pending={state.help_request_pending} onResolved={refreshState} />
          </div>
        </div>

        {cameraProblem && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-warning bg-surface p-4">
            <p className="text-sm">{t('exam.camera.lost')}</p>
            <Button size="sm" onClick={() => void camera.request()}>
              {t('exam.camera.reconnect')}
            </Button>
          </div>
        )}
        {heartbeatLost && proctoring.online && (
          <p role="status" className="mb-4 rounded-(--radius) border border-warning bg-surface p-4 text-sm">
            {t('exam.heartbeatLost')}
          </p>
        )}
        {!proctoring.online && (
          <p role="status" className="mb-4 rounded-(--radius) border border-border bg-surface p-4 text-sm">
            {t('exam.offline')}
          </p>
        )}
        {submitError && (
          <p role="alert" className="mb-4 rounded-(--radius) border border-error bg-surface p-4 text-sm">
            {t(submitError === 'save' ? 'exam.submit.saveFailed' : 'exam.submit.failed')}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <aside className="space-y-4">
            <Palette total={questions.length} current={current} answered={answered} onSelect={go} />
            <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={submitting}>
              {t('exam.submit.button')}
            </Button>
          </aside>
          <div className="space-y-6 rounded-(--radius) border border-border bg-surface p-6">
            {question && (
              <QuestionView
                key={question.id}
                question={question}
                index={current}
                total={questions.length}
                answer={answers[question.id]}
                onChange={(value, kind) => setAnswer(question, value, kind)}
              />
            )}
            <div className="flex justify-between">
              <Button variant="outline" disabled={current === 0} onClick={() => go(current - 1)}>
                {t('exam.question.previous')}
              </Button>
              <Button variant="outline" disabled={current >= questions.length - 1} onClick={() => go(current + 1)}>
                {t('exam.question.next')}
              </Button>
            </div>
          </div>
        </div>

        <p role="status" className="mt-4 text-xs text-muted">
          {t(pending > 0 ? 'exam.status.saving' : 'exam.status.saved')}
        </p>
      </div>

      {cameraRequired && (
        <CameraVideo
          stream={camera.stream}
          videoRef={proctoring.setMonitorVideo}
          className="pointer-events-none fixed top-0 -left-[10000px] h-60 w-80"
        />
      )}
      {cameraRequired && previewOn && (
        <div className="fixed right-4 bottom-4 z-30 rounded-(--radius) border border-border bg-surface p-2 shadow-card">
          <CameraVideo
            stream={camera.stream}
            label={t('exam.camera.preview')}
            className="aspect-4/3 w-48 rounded-md bg-text/10 object-cover"
          />
        </div>
      )}

      {needsFullscreen && (
        <div
          role="alert"
          className={`fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shadow-card bg-surface ${
            proctoring.fullscreenExits >= FULLSCREEN_STRONG_AFTER ? 'border-error' : 'border-warning'
          }`}
        >
          <p className="text-sm font-medium">
            {t(proctoring.fullscreenExits >= FULLSCREEN_STRONG_AFTER ? 'exam.fullscreen.strongBody' : 'exam.fullscreen.body')}
          </p>
          <Button size="sm" onClick={() => void document.documentElement.requestFullscreen().catch(() => undefined)}>
            {t('exam.fullscreen.return')}
          </Button>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {announcement}
        {proctoring.blockedNote ? t('exam.lockdown.note') : ''}
      </div>
      {proctoring.blockedNote && (
        <p className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-(--radius) border border-border bg-surface px-4 py-2 text-sm shadow-card" aria-hidden>
          {t('exam.lockdown.note')}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('exam.submit.confirmTitle')}
        body={t('exam.submit.confirmBody', { answered: answeredCount, total: questions.length })}
        confirmLabel={t('exam.submit.confirm')}
        loading={submitting}
        onConfirm={() => void finalize(false)}
      />
    </ExamLayout>
  )
}

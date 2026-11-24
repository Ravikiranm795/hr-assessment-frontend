import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Spinner } from '@/components/Spinner'
import { examApi } from '../examApi'
import { examErrorText, isAlreadySubmitted, isSectionGone, isSessionLost, isTerminal } from '../errors'
import { ExamLayout } from '../ExamLayout'
import { HelpPanel } from '../HelpPanel'
import { CameraVideo, useCamera } from '../proctor/camera'
import { HEARTBEAT_FAIL_LIMIT, getProctorSessionId } from '../proctor/heartbeat'
import type { AnswerValue, ExamQuestion, ExamSection } from '../types'
import { AnswerSync, storageKey } from './answerSync'
import { CodeSection } from './CodeSection'
import { Palette } from './Palette'
import { QuestionView, isAnswered, type AnswerKind } from './QuestionView'
import { SectionOverview, isClosed, sectionName, stateLabel } from './SectionOverview'
import { formatClock, useServerClock } from './useServerClock'
import { useProctoring } from './useProctoring'
import type { ExamRunnerProps } from './ExamRunner'

const HEARTBEAT_MS = 10_000
const FULLSCREEN_STRONG_AFTER = 3
const ANNOUNCE_AT = [600, 300, 60]
const SUBMIT_TRIES = 4

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type View = { kind: 'overview' } | { kind: 'section'; key: string }
interface Loaded {
  key: string
  questions: ExamQuestion[]
}

/**
 * The running exam for a sectioned attempt (a coding question is its own timed section). Camera, proctoring,
 * heartbeat and final submit are attempt-level, exactly as in the plain runner; on top of that the candidate
 * moves between a section overview and the sections, each with its own server-owned clock.
 */
export function SectionedSurface({ state, inviteToken, resumed, onSubmitted, onFatal, refreshState }: ExamRunnerProps) {
  const { t } = useTranslation()
  const camera = useCamera()
  const cameraRequired = state.camera_required
  // The clock always belongs to the running section: every section update from the server re-bases it.
  const clock = useServerClock(null)
  const proctoring = useProctoring({
    active: true,
    cameraRequired,
    snapshotIntervalSeconds: state.snapshot_interval_seconds,
    resumed,
  })

  const [ready, setReady] = useState(false)
  const [sections, setSections] = useState<ExamSection[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'overview' })
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [current, setCurrent] = useState(0)
  const [pending, setPending] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [confirmSection, setConfirmSection] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [previewOn, setPreviewOn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<'save' | 'submit' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement)
  const [heartbeatLost, setHeartbeatLost] = useState(false)

  const sync = useRef<AnswerSync | null>(null)
  const submittingRef = useRef(false)
  const finalizeRef = useRef<(auto: boolean) => Promise<void>>(() => Promise.resolve())
  const sectionsRef = useRef<ExamSection[]>([])
  const viewRef = useRef<View>(view)
  const restoredRef = useRef<Record<string, unknown>>({})
  const epoch = useRef(0)
  const checkingClock = useRef(false)
  const moved = useRef(false)

  const { left, sync: syncClock } = clock
  const { finish } = proctoring
  const cameraStop = camera.stop

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const applySections = useCallback(
    (list: ExamSection[], active: string | null) => {
      sectionsRef.current = list
      setSections(list)
      setActiveKey(active)
      const running = active ? list.find((s) => s.key === active) : undefined
      if (running) syncClock(running.remaining_seconds)
    },
    [syncClock],
  )

  const nameOf = useCallback(
    (key: string) => {
      const s = sectionsRef.current.find((x) => x.key === key)
      return s ? sectionName(t, s, sectionsRef.current, false) : key
    },
    [t],
  )

  // Final submit: flush answers first, then send; repeat-safe on the server.
  const finalize = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setSubmitting(true)
      setSubmitError(null)
      setConfirmAll(false)
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

  // A section the candidate was in has closed (time over, or submitted elsewhere): keep the answers, go to the list.
  const leaveClosed = useCallback(
    (key: string, state: string) => {
      void sync.current?.flush()
      setNotice(t(state === 'expired' ? 'exam.sections.expired' : 'exam.sections.submitted', { name: nameOf(key) }))
      setView((v) => (v.kind === 'section' && v.key === key ? { kind: 'overview' } : v))
      setLoaded(null)
    },
    [t, nameOf],
  )

  // Start: local unsent answers, then where the server says things are (a reload resumes the running section).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saver = new AnswerSync(await storageKey(inviteToken), {
        onRemaining: () => undefined, // saves report the saved question's section, not necessarily the running one
        onTimeOver: () => void finalizeRef.current(true),
        onSubmitted,
        onFatal,
        onPending: setPending,
      })
      sync.current = saver
      try {
        const restored = await saver.restore()
        const out = await examApi.sections()
        if (cancelled) return
        restoredRef.current = restored
        applySections(out.sections, out.active_key)
        const running = out.sections.find((s) => s.key === out.active_key)
        if (running && !isClosed(running)) setView({ kind: 'section', key: running.key })
        setReady(true)
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
  }, [inviteToken, applySections, onSubmitted, onFatal])

  // The questions and saved answers of the section being shown.
  const viewKey = view.kind === 'section' ? view.key : null
  useEffect(() => {
    if (viewKey === null) return
    let cancelled = false
    examApi
      .questions(viewKey)
      .then((out) => {
        if (cancelled) return
        const restored = restoredRef.current
        restoredRef.current = {}
        setAnswers((prev) => ({ ...prev, ...out.answers, ...restored }))
        setCurrent(0)
        setLoaded({ key: viewKey, questions: [...out.questions].sort((a, b) => a.position - b.position) })
        syncClock(out.remaining_seconds)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (isAlreadySubmitted(error)) return onSubmitted()
        if (isTerminal(error)) return onFatal(error)
        if (isSectionGone(error)) {
          setView({ kind: 'overview' })
          setActionError(examErrorText(error))
          void examApi.sections().then((o) => applySections(o.sections, o.active_key), () => undefined)
          return
        }
        setLoadError(examErrorText(error))
      })
    return () => {
      cancelled = true
    }
  }, [viewKey, syncClock, applySections, onSubmitted, onFatal])

  // The server clock: re-sync the sections on every heartbeat, and when the tab or the network comes back.
  useEffect(() => {
    if (!ready) return
    let fails = 0
    const beat = async () => {
      const startedAt = epoch.current
      try {
        const out = await examApi.heartbeat({
          session_id: getProctorSessionId(),
          visible: document.visibilityState === 'visible',
        })
        fails = 0
        setHeartbeatLost(false)
        if (out.status === 'submitted') return onSubmitted()
        if (out.time_over) return void finalizeRef.current(true)
        // A section change made while this call was in flight is newer than its answer.
        if (out.sections && startedAt === epoch.current) {
          applySections(out.sections, out.active_key ?? null)
          const viewed = viewRef.current
          const shown = viewed.kind === 'section' ? out.sections.find((s) => s.key === viewed.key) : undefined
          if (shown && isClosed(shown)) leaveClosed(shown.key, shown.state)
          else if (out.section_expired && out.section_expired !== viewKeyOf(viewed)) {
            setNotice(t('exam.sections.expired', { name: nameOf(out.section_expired) }))
          }
        }
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
  }, [ready, applySections, leaveClosed, nameOf, t, onSubmitted, onFatal])

  // The local clock of the section on screen reached zero: ask the server, it decides.
  useEffect(() => {
    if (viewKey === null || viewKey !== activeKey || left !== 0 || checkingClock.current) return
    checkingClock.current = true
    void (async () => {
      try {
        const out = await examApi.sections()
        applySections(out.sections, out.active_key)
        const s = out.sections.find((x) => x.key === viewKey)
        if (s && isClosed(s)) leaveClosed(viewKey, s.state)
      } catch (error) {
        if (isAlreadySubmitted(error)) onSubmitted()
      } finally {
        checkingClock.current = false
      }
    })()
  }, [viewKey, activeKey, left, applySections, leaveClosed, onSubmitted])

  useEffect(() => {
    if (viewKey !== null && left !== null && ANNOUNCE_AT.includes(left)) {
      setAnnouncement(t('exam.timer.announce', { minutes: left / 60 }))
    }
  }, [viewKey, left, t])

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!moved.current || !loaded) return
    document.getElementById(`question-${loaded.questions[current]?.id}`)?.focus()
  }, [current, loaded])

  const flushAnswers = async () => {
    const saver = sync.current
    const ok = saver ? await saver.flush() : true
    if (!ok) setActionError(t('exam.sections.saveFailed'))
    return ok
  }

  const failAction = (error: unknown) => {
    if (isAlreadySubmitted(error)) return onSubmitted()
    if (isTerminal(error)) return onFatal(error)
    setActionError(examErrorText(error))
    if (isSectionGone(error)) void examApi.sections().then((o) => applySections(o.sections, o.active_key), () => undefined)
  }

  // Entering starts or resumes the section's clock and pauses the one that was running.
  const enter = async (key: string) => {
    setActionError(null)
    setBusyKey(key)
    try {
      if (!(await flushAnswers())) return
      const before = sectionsRef.current.find((s) => s.key === activeKey && !isClosed(s))
      const out = await examApi.enterSection(key)
      epoch.current += 1
      applySections(out.sections, out.active_key)
      setLoaded(null)
      setLoadError(null)
      setView({ kind: 'section', key })
      setNotice(
        before && before.key !== key
          ? t('exam.sections.switchNotice', { name: sectionName(t, before, sectionsRef.current, false) })
          : t('exam.sections.enterNotice'),
      )
    } catch (error) {
      failAction(error)
    } finally {
      setBusyKey(null)
    }
  }

  const submitSection = async () => {
    if (view.kind !== 'section') return
    const key = view.key
    setConfirmSection(false)
    setActionError(null)
    setBusyKey(key)
    try {
      if (!(await flushAnswers())) return
      const out = await examApi.submitSection(key)
      epoch.current += 1
      applySections(out.sections, out.active_key)
      setNotice(t('exam.sections.submitted', { name: nameOf(key) }))
      setLoaded(null)
      setView({ kind: 'overview' })
    } catch (error) {
      failAction(error)
    } finally {
      setBusyKey(null)
    }
  }

  const setAnswer = (question: ExamQuestion, value: AnswerValue, kind: AnswerKind) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
    sync.current?.set(question.id, value, kind)
  }
  const go = (index: number) => {
    moved.current = true
    setCurrent(index)
  }

  const questions = loaded?.key === viewKey ? loaded?.questions : undefined
  const answered = useMemo(
    () => (questions ?? []).map((q) => isAnswered(q, answers[q.id])),
    [questions, answers],
  )
  const needsFullscreen = document.fullscreenEnabled && !fullscreen && !submitting
  const cameraProblem = cameraRequired && camera.status !== 'active' && camera.status !== 'starting'
  const shownSection = sections.find((s) => s.key === viewKey)
  const unfinished = sections.filter((s) => !isClosed(s)).length

  if (loadError && !ready) {
    return (
      <ExamLayout state={state}>
        <div role="alert" className="space-y-4">
          <p>{loadError}</p>
          <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
        </div>
      </ExamLayout>
    )
  }
  if (!ready) {
    return (
      <ExamLayout state={state}>
        <Spinner label={t('exam.loading')} />
      </ExamLayout>
    )
  }

  const question = questions?.[current]
  return (
    <ExamLayout state={state} narrow={false}>
      <div className="select-none print:hidden [&_input]:select-text [&_textarea]:select-text">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            {shownSection ? (
              <>
                <span className="text-sm text-muted">{t('exam.timer.label')}</span>
                <span role="timer" aria-live="off" className="font-mono text-xl font-semibold tabular-nums">
                  {left === null ? '--:--' : formatClock(left)}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium">{t('exam.sections.title')}</span>
            )}
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

        {shownSection && (
          <nav aria-label={t('exam.sections.barLabel')} className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" disabled={busyKey !== null} onClick={() => setView({ kind: 'overview' })}>
              {t('exam.sections.overview')}
            </Button>
            {sections.map((s) => {
              const closed = isClosed(s)
              const label = sectionName(t, s, sections, false)
              return (
                <Button
                  key={s.key}
                  variant={s.key === viewKey ? 'primary' : 'outline'}
                  size="sm"
                  aria-current={s.key === viewKey ? 'true' : undefined}
                  disabled={closed || busyKey !== null}
                  loading={busyKey === s.key}
                  onClick={() => (s.key === viewKey ? undefined : void enter(s.key))}
                >
                  {label}
                  {closed && ` · ${stateLabel(t, s.state)}`}
                </Button>
              )
            })}
          </nav>
        )}

        {notice && (
          <p role="status" className="mb-4 rounded-(--radius) border border-border bg-surface p-3 text-sm">
            {notice}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mb-4 rounded-(--radius) border border-warning bg-surface p-3 text-sm">
            {actionError}
          </p>
        )}
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

        {!shownSection && (
          <SectionOverview
            sections={sections}
            activeKey={activeKey}
            activeLeft={left}
            busyKey={busyKey}
            submitting={submitting}
            onEnter={(key) => void enter(key)}
            onSubmitAll={() => setConfirmAll(true)}
          />
        )}

        {shownSection && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">{sectionName(t, shownSection, sections)}</h1>
              <Button variant="outline" disabled={busyKey !== null || !questions} onClick={() => setConfirmSection(true)}>
                {t('exam.sections.submitSection')}
              </Button>
            </div>

            {loadError && (
              <div role="alert" className="space-y-3">
                <p>{loadError}</p>
                <Button onClick={() => setView({ kind: 'overview' })}>{t('exam.sections.overview')}</Button>
              </div>
            )}
            {!loadError && !questions && <Spinner label={t('exam.loading')} />}

            {questions && shownSection.kind === 'code' && question && (
              <div className="rounded-(--radius) border border-border bg-surface p-6">
                <CodeSection
                  key={question.id}
                  question={question}
                  answer={answers[question.id]}
                  onChange={(value) => setAnswer(question, value, 'text')}
                  flush={async () => (sync.current ? sync.current.flush() : true)}
                />
              </div>
            )}

            {questions && shownSection.kind === 'mcq' && (
              <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
                <aside>
                  <Palette total={questions.length} current={current} answered={answered} onSelect={go} />
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
            )}
          </div>
        )}

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
        open={confirmSection}
        onOpenChange={setConfirmSection}
        title={t('exam.sections.submitSectionTitle')}
        body={t('exam.sections.submitSectionBody', { name: shownSection ? sectionName(t, shownSection, sections, false) : '' })}
        confirmLabel={t('exam.sections.submitSectionConfirm')}
        loading={busyKey !== null}
        onConfirm={() => void submitSection()}
      />
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t(unfinished === 0 ? 'exam.sections.submitAllTitle' : 'exam.sections.submitEarlyTitle')}
        body={unfinished === 0 ? t('exam.sections.submitAllBody') : t('exam.sections.submitEarlyBody', { count: unfinished })}
        confirmLabel={t('exam.submit.confirm')}
        loading={submitting}
        onConfirm={() => void finalize(false)}
      />
    </ExamLayout>
  )
}

function viewKeyOf(view: View): string | null {
  return view.kind === 'section' ? view.key : null
}

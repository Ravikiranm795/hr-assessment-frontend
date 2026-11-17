import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { applyBranding, type BrandingOut } from '@/core/branding'
import { resetTheme } from '@/core/theme'
import { examApi } from './examApi'
import { isAlreadySubmitted, isTerminal } from './errors'
import { ExamLayout, ExamLoading } from './ExamLayout'
import { CameraProvider } from './proctor/camera'
import { ExamRunner } from './runner/ExamRunner'
import { DeviceUnsupportedScreen, ExamErrorScreen, ThankYouScreen } from './Screens'
import { ConsentStep } from './steps/ConsentStep'
import { InstructionsStep } from './steps/InstructionsStep'
import { SystemCheckStep } from './steps/SystemCheckStep'
import type { ExamState } from './types'

const MIN_WIDTH = 900
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i
const isUnsupportedDevice = () => window.innerWidth < MIN_WIDTH || MOBILE_UA.test(navigator.userAgent)

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'submitted'; state: ExamState | null }
  | { kind: 'ready'; state: ExamState }

// Opening twice at once (React dev double-mount) could race the browser binding cookie, so one
// open per link is shared by every caller until it settles.
let opening: { token: string; promise: Promise<ExamState> } | null = null
function openAndLoad(token: string): Promise<ExamState> {
  if (opening?.token !== token) {
    const promise = (async () => {
      await examApi.open(token)
      return examApi.state()
    })()
    opening = { token, promise }
    const clear = () => {
      if (opening?.promise === promise) opening = null
    }
    promise.then(clear, clear)
  }
  return opening.promise
}

/** Public candidate exam page. The step shown comes from the server state, never from the URL. */
export function ExamPage() {
  return (
    <CameraProvider>
      <ExamFlow />
    </CameraProvider>
  )
}

function ExamFlow() {
  const { token = '' } = useParams()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [unsupported, setUnsupported] = useState(isUnsupportedDevice)
  const [instructionsSeen, setInstructionsSeen] = useState(false)
  const [startedHere, setStartedHere] = useState(false)

  useEffect(() => {
    const onResize = () => setUnsupported(isUnsupportedDevice())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    openAndLoad(token)
      .then((state) => {
        if (cancelled) return
        setPhase(state.status === 'submitted' ? { kind: 'submitted', state } : { kind: 'ready', state })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // A submitted link has no session to load from: the server says so, and the candidate sees the thank-you.
        setPhase(isAlreadySubmitted(error) ? { kind: 'submitted', state: null } : { kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // The organization's colours apply to the exam too; the starter theme returns on leaving.
  const branding = phase.kind === 'ready' ? phase.state.branding : null
  useEffect(() => {
    if (!branding) return
    applyBranding(branding as unknown as BrandingOut)
    return resetTheme
  }, [branding])

  const refreshState = useCallback(() => {
    examApi
      .state()
      .then((state) => setPhase(state.status === 'submitted' ? { kind: 'submitted', state } : { kind: 'ready', state }))
      .catch((error: unknown) => {
        if (isAlreadySubmitted(error)) setPhase({ kind: 'submitted', state: null })
        else if (isTerminal(error)) setPhase({ kind: 'error', error })
      })
  }, [])
  const onSubmitted = useCallback(() => setPhase((prev) => ({ kind: 'submitted', state: prev.kind === 'ready' ? prev.state : null })), [])
  const onFatal = useCallback((error: unknown) => setPhase({ kind: 'error', error }), [])
  const onStarted = useCallback(() => {
    setStartedHere(true)
    refreshState()
  }, [refreshState])

  if (unsupported) return <DeviceUnsupportedScreen />
  if (phase.kind === 'loading') return <ExamLoading />
  if (phase.kind === 'error') return <ExamErrorScreen error={phase.error} />
  if (phase.kind === 'submitted') return <ThankYouScreen state={phase.state} />

  const { state } = phase
  if (state.status === 'in_progress') {
    return (
      <ExamRunner
        state={state}
        inviteToken={token}
        resumed={!startedHere}
        onSubmitted={onSubmitted}
        onFatal={onFatal}
        refreshState={refreshState}
      />
    )
  }
  if (!state.consented) {
    return (
      <ExamLayout state={state}>
        {instructionsSeen ? (
          <ConsentStep
            state={state}
            onDone={refreshState}
            onBack={() => setInstructionsSeen(false)}
            onHelpResolved={refreshState}
          />
        ) : (
          <InstructionsStep state={state} onContinue={() => setInstructionsSeen(true)} onHelpResolved={refreshState} />
        )}
      </ExamLayout>
    )
  }
  return (
    <ExamLayout state={state}>
      <SystemCheckStep state={state} onStarted={onStarted} onFatal={onFatal} onHelpResolved={refreshState} />
    </ExamLayout>
  )
}

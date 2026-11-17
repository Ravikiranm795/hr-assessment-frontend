import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/Toast'
import { ApiError, errorText, fieldErrorText } from '@/core/api/errors'
import { assessmentsApi, keys, type AssessmentDetail, type QuestionOut, type VersionOut } from '../api'
import {
  fromServer,
  isDirtyQuestion,
  questionIssues,
  SAVE_BLOCKING,
  settingsFrom,
  toPayload,
  validateSettings,
  versionPatch,
  type DraftQuestion,
  type Settings,
  type SettingsErrors,
} from './model'

export interface BuilderState {
  settings: Settings
  savedSettings: Settings
  questions: DraftQuestion[]
  deletedIds: string[]
  /** Question ids in the order the server holds them. */
  serverOrder: string[]
  settingsErrors: SettingsErrors
  showProblems: boolean
  /** Bumped by every user edit; drives the autosave debounce. */
  edits: number
}

export type BuilderAction =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'add'; question: DraftQuestion }
  | { type: 'patch'; key: string; patch: Partial<DraftQuestion> }
  | { type: 'remove'; key: string }
  | { type: 'move'; from: string; to: string }
  | { type: 'append'; items: QuestionOut[] }
  | { type: 'problems' }
  | { type: 'settingsErrors'; errors: SettingsErrors }
  | { type: 'savedSettings'; patch: Partial<Settings> }
  | { type: 'result'; key: string; id?: string; savedRev: number }
  | { type: 'questionError'; key: string; error: string; fieldErrors: Record<string, string> }
  | { type: 'deleted'; id: string }
  | { type: 'order'; ids: string[] }

export function initialState(assessment: AssessmentDetail, version: VersionOut): BuilderState {
  const settings = settingsFrom(assessment, version)
  const questions = [...version.questions].sort((a, b) => a.position - b.position).map(fromServer)
  return {
    settings,
    savedSettings: settings,
    questions,
    deletedIds: [],
    serverOrder: questions.map((q) => q.id as string),
    settingsErrors: {},
    showProblems: false,
    edits: 0,
  }
}

function reducer(state: BuilderState, a: BuilderAction): BuilderState {
  switch (a.type) {
    case 'settings':
      return { ...state, settings: { ...state.settings, ...a.patch }, edits: state.edits + 1 }
    case 'add':
      return { ...state, questions: [...state.questions, a.question], edits: state.edits + 1 }
    case 'append': {
      const added = a.items.map(fromServer)
      return {
        ...state,
        questions: [...state.questions, ...added],
        serverOrder: [...state.serverOrder, ...added.map((q) => q.id as string)],
      }
    }
    case 'patch':
      return {
        ...state,
        edits: state.edits + 1,
        questions: state.questions.map((q) =>
          q.key === a.key ? { ...q, ...a.patch, rev: q.rev + 1, error: null, fieldErrors: {} } : q,
        ),
      }
    case 'remove': {
      const target = state.questions.find((q) => q.key === a.key)
      return {
        ...state,
        edits: state.edits + 1,
        questions: state.questions.filter((q) => q.key !== a.key),
        deletedIds: target?.id ? [...state.deletedIds, target.id] : state.deletedIds,
      }
    }
    case 'move': {
      const from = state.questions.findIndex((q) => q.key === a.from)
      const to = state.questions.findIndex((q) => q.key === a.to)
      if (from < 0 || to < 0 || from === to) return state
      const next = [...state.questions]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...state, questions: next, edits: state.edits + 1 }
    }
    case 'problems':
      return { ...state, showProblems: true }
    case 'settingsErrors':
      return { ...state, settingsErrors: a.errors }
    case 'savedSettings':
      return { ...state, savedSettings: { ...state.savedSettings, ...a.patch } }
    case 'result':
      return {
        ...state,
        serverOrder: a.id && !state.serverOrder.includes(a.id) ? [...state.serverOrder, a.id] : state.serverOrder,
        questions: state.questions.map((q) =>
          q.key === a.key ? { ...q, id: a.id ?? q.id, savedRev: a.savedRev, error: null, fieldErrors: {} } : q,
        ),
      }
    case 'questionError':
      return {
        ...state,
        questions: state.questions.map((q) => (q.key === a.key ? { ...q, error: a.error, fieldErrors: a.fieldErrors } : q)),
      }
    case 'deleted':
      return {
        ...state,
        deletedIds: state.deletedIds.filter((id) => id !== a.id),
        serverOrder: state.serverOrder.filter((id) => id !== a.id),
      }
    case 'order':
      return { ...state, serverOrder: a.ids }
  }
}

const sameSettings = (a: Settings, b: Settings) => JSON.stringify(a) === JSON.stringify(b)

export function isDirty(s: BuilderState): boolean {
  if (!sameSettings(s.settings, s.savedSettings)) return true
  if (s.deletedIds.length > 0 || s.questions.some(isDirtyQuestion)) return true
  const ids = s.questions.filter((q) => q.id).map((q) => q.id)
  return ids.length !== s.serverOrder.length || ids.some((id, i) => id !== s.serverOrder[i])
}

/** Questions or settings that cannot be saved as they are (shown as "needs attention"). */
export function attentionCount(s: BuilderState): number {
  const blocked = s.questions.filter((q) => questionIssues(q).some((c) => SAVE_BLOCKING.includes(c))).length
  return blocked + Object.keys(validateSettings(s.settings)).length
}

interface UseBuilderArgs {
  assessment: AssessmentDetail
  version: VersionOut
  editable: boolean
  /** Called when the server says the version is already published (`ASSESSMENT_IMMUTABLE`). */
  onImmutable: () => void
}

const AUTOSAVE_MS = 3000

/**
 * Local draft of one version plus a save engine (spec F4: Save draft + autosave every few seconds).
 * The state lives in a small external store so the save engine always reads the latest edits synchronously.
 */
function createStore(initial: BuilderState) {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    dispatch: (action: BuilderAction) => {
      current = reducer(current, action)
      listeners.forEach((l) => l())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useBuilder({ assessment, version, editable, onImmutable }: UseBuilderArgs) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [store] = useState(() => createStore(initialState(assessment, version)))
  const state = useSyncExternalStore(store.subscribe, store.get)
  const dispatch = store.dispatch
  const [saving, setSaving] = useState(false)
  const [doneEdits, setDoneEdits] = useState(-1)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [failed, setFailed] = useState(false)
  const chain = useRef<Promise<boolean>>(Promise.resolve(true))
  const assessmentId = assessment.id
  const versionId = version.id

  const run = useCallback(
    async (mode: 'manual' | 'auto'): Promise<boolean> => {
      if (!editable) return true
      const snap = store.get()
      setSaving(true)
      let ok = true
      let wrote = false
      let stop = false
      const fail = (error: unknown) => {
        ok = false
        if (error instanceof ApiError && error.is('ASSESSMENT_IMMUTABLE')) {
          stop = true
          onImmutable()
        } else if (mode === 'manual') toast.error(error)
      }
      try {
        if (mode === 'manual') dispatch({ type: 'problems' })
        const s = snap.settings
        const saved = snap.savedSettings
        const errs = validateSettings(s)
        dispatch({ type: 'settingsErrors', errors: errs })
        if (Object.keys(errs).length > 0) ok = false

        if ((s.title !== saved.title || s.description !== saved.description) && !errs.title) {
          try {
            const detail = await assessmentsApi.patch(assessmentId, { title: s.title.trim(), description: s.description.trim() || null })
            queryClient.setQueryData(keys.detail(assessmentId), detail)
            dispatch({ type: 'savedSettings', patch: { title: s.title, description: s.description } })
            wrote = true
          } catch (error) {
            if (error instanceof ApiError && error.fieldErrors.length > 0) {
              const next: SettingsErrors = { ...errs }
              if (error.fieldErrors.some((f) => f.field.endsWith('title'))) next.title = fieldErrorText(error.fieldErrors[0].code)
              dispatch({ type: 'settingsErrors', errors: next })
              ok = false
            } else fail(error)
          }
        }

        const patch = versionPatch(s, saved, errs)
        if (!stop && Object.keys(patch).length > 0) {
          try {
            await assessmentsApi.patchVersion(assessmentId, versionId, patch)
            const sent: Partial<Settings> = {
              instructions_html: s.instructions_html,
              company_name: s.company_name,
              footer_html: s.footer_html,
              shuffle_questions: s.shuffle_questions,
              shuffle_options: s.shuffle_options,
            }
            if (!errs.duration) sent.duration = s.duration
            if (!errs.passMark) sent.passMark = s.passMark
            dispatch({ type: 'savedSettings', patch: sent })
            wrote = true
          } catch (error) {
            if (error instanceof ApiError && error.fieldErrors.length > 0) {
              const next: SettingsErrors = { ...errs }
              for (const f of error.fieldErrors) {
                if (f.field.includes('duration')) next.duration = fieldErrorText(f.code)
                if (f.field.includes('pass_mark')) next.passMark = fieldErrorText(f.code)
              }
              dispatch({ type: 'settingsErrors', errors: next })
              ok = false
            } else fail(error)
          }
        }

        for (const id of snap.deletedIds) {
          if (stop) break
          try {
            await assessmentsApi.deleteQuestion(assessmentId, versionId, id)
            dispatch({ type: 'deleted', id })
            wrote = true
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) dispatch({ type: 'deleted', id })
            else fail(error)
          }
        }

        for (const q of snap.questions) {
          if (stop) break
          if (!isDirtyQuestion(q)) continue
          if (questionIssues(q).some((c) => SAVE_BLOCKING.includes(c))) {
            ok = false
            continue
          }
          try {
            const body = toPayload(q)
            if (q.id === null) {
              const out = await assessmentsApi.addQuestion(assessmentId, versionId, body)
              dispatch({ type: 'result', key: q.key, id: out.id, savedRev: q.rev })
            } else {
              await assessmentsApi.patchQuestion(assessmentId, versionId, q.id, body)
              dispatch({ type: 'result', key: q.key, savedRev: q.rev })
            }
            wrote = true
          } catch (error) {
            const fields: Record<string, string> = {}
            if (error instanceof ApiError) {
              for (const f of error.fieldErrors) fields[f.field.split('.').pop() ?? f.field] = fieldErrorText(f.code)
            }
            dispatch({ type: 'questionError', key: q.key, error: errorText(error), fieldErrors: fields })
            if (error instanceof ApiError && error.is('ASSESSMENT_IMMUTABLE')) fail(error)
            else ok = false
          }
        }

        if (!stop) {
          const cur = store.get()
          const ids = cur.questions.filter((q) => q.id).map((q) => q.id as string)
          const sameSet = ids.length === cur.serverOrder.length && ids.every((id) => cur.serverOrder.includes(id))
          const orderChanged = ids.some((id, i) => id !== cur.serverOrder[i])
          if (sameSet && orderChanged) {
            try {
              await assessmentsApi.reorder(assessmentId, versionId, ids)
              dispatch({ type: 'order', ids })
              wrote = true
            } catch (error) {
              fail(error)
            }
          }
        }

        if (wrote) {
          void queryClient.invalidateQueries({ queryKey: ['assessments', 'list'] })
          void queryClient.invalidateQueries({ queryKey: keys.detail(assessmentId) })
        }
        setFailed(!ok)
        if (ok) setLastSavedAt(new Date())
      } finally {
        setDoneEdits(snap.edits)
        setSaving(false)
      }
      return ok
    },
    [assessmentId, versionId, editable, store, dispatch, queryClient, toast, onImmutable],
  )

  const save = useCallback(
    (mode: 'manual' | 'auto') => {
      chain.current = chain.current.then(() => run(mode)).catch(() => false)
      return chain.current
    },
    [run],
  )

  const dirty = isDirty(state)

  // Autosave a few seconds after the last edit. Edits made while a save runs trigger the next one;
  // an unchanged-but-unsaveable draft (needs attention) is not retried in a loop.
  useEffect(() => {
    if (!editable || !dirty || saving || state.edits === doneEdits) return
    const id = window.setTimeout(() => void save('auto'), AUTOSAVE_MS)
    return () => window.clearTimeout(id)
  }, [editable, dirty, saving, state.edits, doneEdits, save])

  const statusText = saving
    ? t('assessments.builder.status.saving')
    : failed || (dirty && attentionCount(state) > 0)
      ? t('assessments.builder.status.attention', { count: Math.max(attentionCount(state), 1) })
      : dirty
        ? t('assessments.builder.status.unsaved')
        : lastSavedAt
          ? t('assessments.builder.status.saved', { time: lastSavedAt.toLocaleTimeString() })
          : t('assessments.builder.status.upToDate')

  return { state, getState: store.get, dispatch, dirty, saving, save, statusText }
}

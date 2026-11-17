import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, refreshSession, setSessionLostHandler, tokenStore } from '@/core/api/client'
import type { FlagKey, MeOut, Role, SessionOut } from './types'

type Status = 'loading' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: Status
  me: MeOut | null
  role: Role | null
  /** Effective feature flag; `false` while signed out. */
  hasFlag: (flag: FlagKey) => boolean
  /** Call after any endpoint that returns a SessionOut with a token (login, totp, google, verify). */
  completeLogin: (session: SessionOut) => Promise<void>
  reloadMe: () => Promise<void>
  signOut: (everywhere?: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<MeOut | null>(null)

  const clear = useCallback(() => {
    tokenStore.set(null)
    setMe(null)
    setStatus('anonymous')
  }, [])

  const reloadMe = useCallback(async () => {
    const data = await api.get<MeOut>('/api/v1/auth/me')
    setMe(data)
    setStatus('authenticated')
  }, [])

  // Quiet restore on page load: the HttpOnly refresh cookie gives a new access token (spec F-05).
  useEffect(() => {
    setSessionLostHandler(clear)
    // Candidates on the public exam page have no staff session: skip the restore call.
    if (window.location.pathname.startsWith('/exam/')) {
      setStatus('anonymous')
      return () => setSessionLostHandler(null)
    }
    let cancelled = false
    void (async () => {
      const token = await refreshSession()
      if (cancelled) return
      if (!token) return clear()
      try {
        await reloadMe()
      } catch {
        if (!cancelled) clear()
      }
    })()
    return () => {
      cancelled = true
      setSessionLostHandler(null)
    }
  }, [clear, reloadMe])

  const completeLogin = useCallback(
    async (session: SessionOut) => {
      tokenStore.set(session.access_token)
      await reloadMe()
    },
    [reloadMe],
  )

  const signOut = useCallback(
    async (everywhere = false) => {
      try {
        await api.post(everywhere ? '/api/v1/auth/logout-all' : '/api/v1/auth/logout', undefined, {
          skipRefresh: true,
        })
      } finally {
        clear()
      }
    },
    [clear],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      role: me?.user.role ?? null,
      hasFlag: (flag) => me?.flags[flag] === true,
      completeLogin,
      reloadMe,
      signOut,
    }),
    [status, me, completeLogin, reloadMe, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

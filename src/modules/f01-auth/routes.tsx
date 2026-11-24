import type { RouteObject } from 'react-router-dom'
import { lazyNamed } from '@/app/lazyNamed'

const ChangePasswordPage = lazyNamed(() => import('./ChangePasswordPage'), 'ChangePasswordPage')
const LoginPage = lazyNamed(() => import('./LoginPage'), 'LoginPage')
const SsoDonePage = lazyNamed(() => import('./SsoDonePage'), 'SsoDonePage')
const TotpLoginPage =lazyNamed(() => import('./TotpLoginPage'), 'TotpLoginPage')
const TotpSetupPage = lazyNamed(() => import('./TotpSetupPage'), 'TotpSetupPage')

/** Public auth steps (outside RequireAuth). */
export const publicRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/login/totp', element: <TotpLoginPage /> },
  { path: '/sso/done', element: <SsoDonePage /> },
]

/** Signed-in account steps. They stay reachable while `must_change_password` is pending. */
export const accountRoutes: RouteObject[] = [
  { path: '/change-password', element: <ChangePasswordPage /> },
  { path: '/totp/setup', element: <TotpSetupPage /> },
]

import type { RouteObject } from 'react-router-dom'
import { ChangePasswordPage } from './ChangePasswordPage'
import { LoginPage } from './LoginPage'
import { TotpLoginPage } from './TotpLoginPage'
import { TotpSetupPage } from './TotpSetupPage'

/** Public auth steps (outside RequireAuth). */
export const publicRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/login/totp', element: <TotpLoginPage /> },
]

/** Signed-in account steps. They stay reachable while `must_change_password` is pending. */
export const accountRoutes: RouteObject[] = [
  { path: '/change-password', element: <ChangePasswordPage /> },
  { path: '/totp/setup', element: <TotpSetupPage /> },
]

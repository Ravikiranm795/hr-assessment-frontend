import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { RequireAuth } from '@/core/auth/guards'
import { AppShell } from '@/modules/f02-shell/AppShell'
import { Home, NotFound } from './pages'

// Modules plug in by exporting from `src/modules/<module>/routes.tsx`; nothing here changes per module:
//   publicRoutes  - outside sign-in and outside the shell (/login, /exam/:token)
//   accountRoutes - signed in, full-page, outside the shell (/change-password, /totp/setup)
//   shellRoutes   - signed in, inside the app shell (wrap pages in <RequireAccess roles flag>)
interface ModuleRoutes {
  publicRoutes?: RouteObject[]
  accountRoutes?: RouteObject[]
  shellRoutes?: RouteObject[]
}
const modules = Object.values(import.meta.glob<ModuleRoutes>('/src/modules/*/routes.tsx', { eager: true }))
const collect = (key: keyof ModuleRoutes) => modules.flatMap((m) => m[key] ?? [])

export const router = createBrowserRouter([
  ...collect('publicRoutes'),
  {
    element: <RequireAuth />,
    children: [
      ...collect('accountRoutes'),
      {
        element: <AppShell />,
        children: [{ path: '/', element: <Home /> }, ...collect('shellRoutes'), { path: '*', element: <NotFound /> }],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])

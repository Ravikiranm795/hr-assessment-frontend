import type { RouteObject } from 'react-router-dom'
import { ExamPage } from './ExamPage'

/** The candidate exam is public: no staff sign-in and no app shell. The session token comes from the invite link. */
export const publicRoutes: RouteObject[] = [{ path: '/exam/:token', element: <ExamPage /> }]

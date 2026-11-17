# HR Assessment Platform: frontend handover

React 19, TypeScript 7, Vite 8, Tailwind 4. English only (the structure is ready for more languages). Desktop and laptop only (minimum width 900 px).

## Run it
```
export PATH=/Users/apple/.nvm/versions/node/v24.20.0/bin:$PATH   # Node 24 is required
cd "HR assessment Frnd" && npm install
npm run dev                # http://localhost:3000, proxies /api to the backend on :8000
npm run typecheck && npm run lint && npm run build
npm run gen:api            # after a backend contract change (re-export the backend openapi first)
npx playwright test e2e/<module> --reporter=line   # one module; run the whole suite only when nothing else is running
```
Backend (Docker, from `hr-assessment-backend`): `docker compose -f docker/docker-compose.yml up -d api worker db`. Secrets live in its git-ignored `.env`; do not delete it. Demo accounts (password `DemoPass#2026`): `admin@one.demo.example.com` (org admin), `hana@one.demo.example.com` (HR), `admin@acme.demo.example.com` (org with several features off), `superadmin.daily@platform.demo.example.com`.

## Structure
```
src/app/        providers, router (auto-collects module routes), device gate, not-found page
src/core/       api client (in-memory token, single-flight refresh, error mapping), auth, theme/branding, forms, i18n, utils
src/components/ shared UI (Button, Field, Textarea, Modal, ConfirmDialog, Toast, DataTable, Pager, Badge, Html, RichTextEditor ...)
src/modules/    one folder per screen module, each with routes.tsx and locales/en.json
e2e/            Playwright, one folder per module
docs/progress/  CHECKPOINT, PROGRESS, API_GAPS
public/mediapipe  self-hosted face-detection wasm and model (no CDN at runtime)
```
**Adding a module:** create `src/modules/<name>/routes.tsx` exporting `publicRoutes`, `accountRoutes` and/or `shellRoutes`, and `locales/en.json` under its own top-level key. Neither the router nor `i18n.ts` needs editing. Modules never import from each other; shared code goes in `core` or `components`.

## Modules and routes
| Module | Routes | Who |
|---|---|---|
| f01-auth | `/login`, `/login/totp`, `/change-password`, `/totp/setup` | everyone |
| f02-shell | menu, submenu rail, bell, profile menu, idle warning, theme | signed in |
| f03-dashboard | `/`, `/platform/dashboard`, `/settings/dashboard` (18 gadgets, per-user layout) | staff, super admin |
| f04-assessments | `/assessments`, `/assessments/:id`, `/assessments/:id/versions/:vid` | staff |
| f05-roles | `/roles`, `/roles/:id` (invites, CSV, links shown once) | staff |
| f06-exam | `/exam/:token` (public candidate exam) | candidates |
| f07-review | `/attempts/:id` | role owner, org admin |
| f08-reports | `/reports` (AI chat), `/platform/reports` (filter builder) | org admin, super admin |
| f09-audit | `/audit`, `/platform/audit` | org admin, super admin |
| f10-team | `/team` | org admin |
| f11-settings | `/settings/(profile\|security\|retention\|invites\|email\|ai\|branding\|documents[/:id])` | org admin (profile: staff) |
| f12-platform | `/platform/(orgs[/:id/...]\|flags/defaults\|branding\|usage)` | super admin |
| f13-inbox | `/help-requests` | staff |

A menu entry appears only when the role allows it and the feature flag is on; every route is also wrapped in `RequireAccess` and the backend enforces the same.

## Rules the code follows
- Access token in memory only; the refresh cookie restores the session on reload. All visible text comes from `t('key')` (lint fails on hard-coded English). Backend errors map by `message_key`. Dates render in the organization's timezone.
- Backend HTML is always sanitized with DOMPurify before rendering. Write-only secrets (SMTP password, AI key) are never pre-filled. Invite links are shown once.
- The exam never auto-submits or rejects because of a violation, and never tells the candidate which flags were recorded. The server owns the clock.

## Known limits and what is not proven
- **Real face detection is not proven.** Playwright uses a fake camera with no face. A manual session with 5 or 6 real people (different lighting, glasses, looking away, a second person) is required before the HR demo.
- Not exercised against real services: Google sign-in (no client id configured), SMTP send, real AI providers (mock only). Those paths are built from the contract and, where noted in `API_GAPS.md` and the module reports, stubbed in tests.
- Not exercised: drag-reorder gesture (keyboard reorder is wired), the three-versions-in-use limit (replayed response), help-approved path in the exam, real camera disconnect, offline retry, send-by-email, accommodations, extend expiry, regenerate link, role edit/reassign, unlink assessment (not in UI).
- The production bundle is one 2 MB chunk (624 kB gzipped). Next performance step: lazy-load route modules (`React.lazy` per module, the exam first).
- Backend gaps are listed in `docs/progress/API_GAPS.md` (no user edit endpoint, attempt detail without role/owner/version, no public theme endpoint, platform branding has no validate/logo, list endpoints without counts, and more).
- Parked for phase 2 (not built): live monitoring, contributor link, AI candidate summary, AI voice interviewer, sub-organizations, dark mode, more UI languages, screen-share proctoring, platform-provided AI, automatic misuse alerts, per-organization login addresses.

## Testing notes
- Playwright runs with one worker. Do not run several suites at once: the machine load makes 30 s timeouts. The dev login rate limit is raised (`RATE_LIMIT_LOGIN=1000/minute` in the backend `.env`).
- The backend rotates refresh tokens: navigating away while a session restore is in flight reuses a rotated token and ends the session. Tests wait for the page to load before navigating again.
- Tests that restore a setting must change it to something else first (Save is disabled while the form is unchanged).

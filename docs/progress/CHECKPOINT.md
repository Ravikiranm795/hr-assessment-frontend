# CHECKPOINT (resume from here; do not re-read the spec)

Status: STOPPED (saved 2026-11-17: account 5-hour usage limit hit, resets 5:20am Asia/Calcutta). Three parallel agents died mid-work on the same limit.

## Done and verified (typecheck + lint clean for these, e2e green against the live backend)
- **F0 Foundation**: tokens, `en.json` + `errors.*`, `core/api` (in-memory token, single-flight refresh, `ApiError`), `core/auth` (provider, `RequireAuth`, `RequireAccess{roles,flag}`), `core/{theme,branding,forms,utils}`, shared `components/{Button,Field,Textarea,Badge,Html,Modal,ConfirmDialog,Toast,Spinner,StatePage,ErrorState,EmptyState,Pager,DataTable}`, `app/{DeviceGate,Providers,pages,router}`, Playwright harness.
- **Module plug-in contract**: a module owns `src/modules/<mod>/routes.tsx` (exports `publicRoutes` / `accountRoutes` / `shellRoutes`, auto-collected by `app/router.tsx`) and `src/modules/<mod>/locales/en.json` (one top-level namespace, auto-merged by `core/i18n.ts`).
- **F1 Authentication** (e2e 5/5), **F2 App shell** (e2e 6/6), **F7 Candidate review** (e2e 5/5), **F10 Team** (e2e 4/4, incl. real create + deactivate).
- `.oxlintrc.json` now ignores `public/**` (vendored MediaPipe js broke lint).

## In flight: agent work, UNFINISHED (do not trust, do not delete)
All three agents hit the rate limit. They can be resumed with SendMessage (same ids) after 5:20am Asia/Calcutta, or finished by hand. Typecheck currently fails ONLY inside these folders (16 errors: f04 x1, f05 x8, f06 x7).
- **f04-assessments** (agent a4c3eaa3c55493dd5): 12 src files in `src/modules/f04-assessments/` incl. `builder/model.ts`. NO `routes.tsx`, NO `locales/en.json`, no e2e. Known error: unused import `ALLOWED_SCORING`.
- **f05-roles** (agent a66d8e78cc8dd5477): 14 src files, `routes.tsx` present (so `/roles` is reachable but shows raw i18n keys), NO `locales/en.json`, no e2e. Known errors: `me.organization` possibly null (use `me?.organization?.timezone`), and `t` passed where a generic `T` is expected (`RoleDetailPage.tsx` ~lines 145,182,239,245,297,375).
- **f06-exam** (agent adff5c81666ac922c): 10 src files incl. `proctor/faceMonitor.ts`; `public/mediapipe/` has the wasm + `blaze_face_short_range.tflite`. NO `routes.tsx`, NO locales, no e2e. Known errors: `erasableSyntaxOnly` forbids TS parameter properties (`constructor(private x)`) at faceMonitor.ts lines ~63,64,101: declare fields explicitly.
- **f13-inbox**: not started (empty).
Resume briefs: re-send each agent the same task; remind them of the two mandatory rules (brain CLI with Node 24, Read/Write/Edit only), ownership of their own folders, and to add `routes.tsx` + `locales/en.json` + one e2e spec each.

## Next 3 steps (ordered)
1. After 5:20am: resume the three agents (SendMessage) or finish F5/F4/F6/F13 myself; gate with `npm run typecheck && npm run lint` until clean, then one e2e run per module.
2. S4 remaining: F11 Settings (Profile/Security/Retention/Invites/Email/AI/Branding/Documents/Dashboard gadgets; Documents needs the missing `VersionJsonIn` schema, see API_GAPS), F3 Dashboard gadgets, F8 Reports chat, F9 Audit.
3. S5 F12 Super admin; S6 final sweep (i18n/a11y, full Playwright pass, frontend handover doc, manual 5-6 person camera test before HR demo, revisit parked items).

## Tests
- Gate: `npm run typecheck && npm run lint`. Module e2e: `npx playwright test e2e/<module> --reporter=line | tail`. Playwright 1.65.1 needs chromium build 1255 (installed).
- Not yet run: full suite (by design, once at the very end).

## Backend env (resolved 2026-11-17, user authorised)
- Cause: api container had only `DATABASE_URL`; no `.env` -> `TOKEN_PEPPER is not configured` (login 500). Fix: created `hr-assessment-backend/.env` (git-ignored, mode 600) with generated dev secrets; recreated api+worker; ran `reset-demo`. Do not delete `.env`.
- Running: api :8000, worker, db, test-db. Demo accounts, password `DemoPass#2026`: `admin@one.demo.example.com` (org_admin, Asha Menon, all 21 flags), `hana@one.demo.example.com` (hr_user), `admin@acme.demo.example.com` (acme: camera proctoring/bulk invite/reports/AI builder/AI scoring/question bank OFF), `superadmin.daily@platform.demo.example.com`.
- Test data left behind: one inactive HR user `E2E Tester <timestamp>` per F10 e2e run (created then deactivated). `reset-demo` clears them.

## Facts learned from the live API
- Branding GET shape and mapping in `core/branding.ts`; `/platform/branding` is 401 signed out (no public theme endpoint).
- `/auth/me`: `{user, organization{timezone,...}, flags, locale, branding{scope,endpoint}, session_timeout_minutes, totp_setup_required}`.
- `/org/settings/security` is org_admin only and unreachable during forced password change.
- Attempt detail (`AttemptReport`): no role title/owner/version. Question types: `single_choice, multi_choice, fill_blank, code_gap, short_answer`. Scoring status values seen: `complete` (assumed `pending`, `needs_manual`).
- Team: `status` filter values are `active|inactive`; list rows have `is_locked`; create returns `{user, temporary_password}`; reset-password returns `{temporary_password}`; no edit endpoint.
- Validation errors can carry field codes outside the catalog (e.g. `decimal_parsing`): `fieldErrorText` falls back to generic "invalid".
- Not configured in dev: `GOOGLE_CLIENT_ID`, SMTP, real AI (mock only).

## Gotchas learned
- Always Node 24 (`export PATH=/Users/apple/.nvm/versions/node/v24.20.0/bin:$PATH`). Vite takes ~4 s to answer.
- The shell is zsh: unquoted `$var` is NOT word-split (broke a curl probe); use functions / explicit args.
- Screenshots can catch `transition-colors` mid-fade; wait ~600 ms.
- Repo is on `build/frontend`; local WIP commit made at this stop-and-save; never push.
- Brain MCP tools not exposed; CLI fallback `PATH=/Users/apple/.nvm/versions/node/v24.20.0/bin:$PATH brain ...`.
- Tailwind 4: `rounded-(--radius)`. TS 7: no `baseUrl`; `erasableSyntaxOnly` (no constructor parameter properties, no enums).

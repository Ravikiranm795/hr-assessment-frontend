# CHECKPOINT (resume from here; do not re-read the spec)

Status: ALL PLANNED MODULES BUILT (2026-11-17). Remaining work is verification with real services and polish, listed below. Full handover: `docs/HANDOVER.md`.

## State
- Modules F1 to F13 are built and plugged in (see `docs/HANDOVER.md` for the route table).
- Gates: `npm run typecheck` 0 errors, `npm run lint` 0 errors (a few warnings), `npm run build` succeeds (one 2 MB chunk).
- Full Playwright suite (75 tests, one worker): 74 passed in the first run; the one failure (exam golden flow: camera `<video>` not visible within the default 5 s on a cold start) passed on a re-run of the exam folder (7/7). The wait for that step was then raised to 20 s; the full suite has NOT been re-run since that edit.

## What is NOT proven (needs real services or people)
- **Real face detection** (MediaPipe no-face, multiple faces, looking away): Playwright uses a fake camera with no face. A manual session with 5 or 6 real people is required before the HR demo.
- Google sign-in (no `GOOGLE_CLIENT_ID`), SMTP send, real AI providers (mock only). AI suggestions in the builder, AI interpret in reports and the report happy path with a real provider are stubbed in tests.
- Not exercised: drag-reorder gesture, three-versions-in-use limit (replayed response), exam help-approved path, real camera disconnect banner, offline retry, send-by-email, accommodations, extend expiry, regenerate link, role edit/reassign, real approve/override/dismiss writes in review, ORG_DISABLED / ADMIN_ONLY_ACTION / PROTECTED_ACCOUNT toasts, usage with real data.
- Visual review: only the shell and settings were looked at by eye; most pages are untouched by a screenshot review.

## Next steps (ordered)
1. Re-run the full suite once (`npx playwright test --reporter=line`) with nothing else running, to confirm the 75/75 after the exam-timeout edit.
2. Manual real-camera session; visual pass over every page (spacing, empty states, the dashboard charts); accessibility sweep (keyboard-only exam, screen reader).
3. Performance: lazy-load route modules (exam first) to split the 2 MB bundle.
4. Promote duplicated bits into `src/components`: SelectField, Banner, CopyButton, TempPasswordDialog (f10 and f12), FlagGrid switch, long-running loader with Cancel, approve/decline help dialog (f05 and f13), format + column picker (f09 and f08), Menu.
5. Backend asks (all in `docs/progress/API_GAPS.md`): user edit endpoint, attempt detail with role/owner/version, public theme endpoint, platform branding validate/logo, list counts, `reset-demo` FK fix.

## Environment facts
- Backend `.env` (git-ignored, mode 600) holds the only copy of the dev secrets: never delete. It also sets `RATE_LIMIT_LOGIN=1000/minute` (the default 10/min broke parallel test runs). api :8000, worker, db, test-db are running.
- Demo accounts, password `DemoPass#2026`: `admin@one.demo.example.com`, `hana@one.demo.example.com`, `admin@acme.demo.example.com`, `superadmin.daily@platform.demo.example.com`.
- **Demo data is polluted by testing and `reset-demo` currently FAILS**: it cannot delete the demo super admin because non-demo test orgs created through `/platform/orgs` (`probe-org-*`, `e2e-fixture-*`, `e2e-platform-*`, all disabled) have rows referencing that user (branding_themes.updated_by was nulled by hand; misuse_flags.cleared_by is the next blocker). Org one has a teal logo, many `E2E ...` roles/assessments/users, and platform branding shows `is_default: false`. Tests create unique data so this does not break them.
- The backend brain index was rebuilt this session; the frontend brain index too.

## Gotchas learned
- Always Node 24 (`export PATH=/Users/apple/.nvm/versions/node/v24.20.0/bin:$PATH`). zsh does not word-split unquoted variables.
- Never run several Playwright suites at once (load average hit 36 and caused 30 s timeouts); never call component functions directly in render (it crashed the dashboard: use JSX).
- Backend rotates refresh tokens: navigating away mid session-restore ends the session; tests wait for the page to load first. A Save button is disabled while a form is unchanged: restore tests must change the value first.
- The router and i18n eagerly glob every module: a half-written agent file can break the whole app during parallel work.
- Tailwind 4 `rounded-(--radius)`; TS 7 no `baseUrl`, `erasableSyntaxOnly` (no constructor parameter properties).
- Local commits only; never push.

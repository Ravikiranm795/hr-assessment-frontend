# Progress log (append one line per completed sub-task)

- 2026-11-17 Setup: repo scaffolded (Vite 8, React 19, TS 7, Tailwind 4), API types generated from openapi (VersionJsonIn stubbed)
- 2026-11-17 F0 core: tokens, i18n + errors.*, API client (single-flight refresh), auth provider + guards, shared components, device gate, router skeleton. typecheck + lint green; dev server + proxy verified live
- 2026-11-17 BLOCKER found and fixed: backend API container missing TOKEN_PEPPER (login 500). Created backend .env, recreated api+worker, reset-demo. Login works for all roles
- 2026-11-17 F0 finish: Field, ConfirmDialog, Toast, forms helper, branding mapping, Playwright harness (+ matching chromium installed), missing libs installed
- 2026-11-17 F1 Authentication done: login/totp/change-password/totp-setup; e2e/f01-auth 5/5 green
- 2026-11-17 F2 App shell done: role+flag menu, submenu rail, bell, profile menu, theme from branding endpoint, idle warning; e2e/f02-shell 6/6 green; a11y fix (nav label)
- 2026-11-17 F7 Candidate review done (main thread): decision/override, answers, violations+snapshots, history, extra time, erase; e2e/f07-review 5/5 green
- 2026-11-17 Promoted Modal, Textarea, Badge, Html to src/components (F7 + F10 share them)
- 2026-11-17 F10 Team done (main thread): list/search/filter, add HR user + one-time password, deactivate with reassign, reactivate, reset password, unlock, sign out everywhere; admin rows read-only; e2e/f10-team 4/4 green
- 2026-11-17 Dispatched agents F6 exam, F4 assessments, F5 roles + F13 inbox; all three stopped by the 5-hour usage limit with partial, un-gated work (see CHECKPOINT)
- 2026-11-17 Module plug-in contract: per-module routes.tsx and locales/en.json auto-collected (enables parallel agents)

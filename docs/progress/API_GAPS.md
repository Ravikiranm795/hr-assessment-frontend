# API gaps and parked items

| Date | Need | Endpoint found? | Decision |
|---|---|---|---|
| 2026-11-17 | Platform-level setting for the login-page "Powered by MRK Innovations" line | No | Parked (phase 2). Login page always shows the line |
| 2026-11-17 | Extra theme variables (2 to 3 more) | Unknown how theme values are stored | Parked unless backend already stores free tokens |
| 2026-11-17 | One-time contributor link for assessments | No | Parked (phase 2) |
| 2026-11-17 | AI candidate summary on review page | No | Parked; add only if a single existing API turns up |
| 2026-11-17 | `POST /api/v1/org/documents/{doc_id}/versions` request body | Yes, but OpenAPI references schema `VersionJsonIn` that is **not defined** (live and exported) | **Needs backend change** (register the schema). `scripts/gen-api.mjs` stubs it. Read the real shape from the backend code (brain index) when building Settings > Documents |
| 2026-11-17 | "Require authenticator app" org setting | Reported via `totp_setup_required`, not enforced at login | Show the setup flow when reported; no enforcement in UI |
| 2026-11-17 | Show the org's password rules on the forced change-password screen | `GET /org/settings/security` exists but is org_admin only and blocked while `must_change_password` | Screen shows a generic hint; server `PASSWORD_POLICY_FAILED` / field errors are the source of truth. Backend could expose the policy in `/auth/me` or a public-to-self endpoint |
| 2026-11-17 | Platform theme on the signed-out login page | `/platform/branding` returns 401 signed out | Login uses the starter MRK theme until a public branding endpoint exists |
| 2026-11-17 | Know whether Google sign-in is enabled before login | No public setting; `GOOGLE_CLIENT_ID` empty in dev | Google button renders only when `VITE_GOOGLE_CLIENT_ID` is set at build time |
| 2026-11-17 | Review page header: role title, assessment version, role owner | `GET /api/v1/attempts/{id}` returns none of them (no `role_id`, `owner_id`, version) | Header shows candidate, status, badges only. Decision buttons render for anyone who can open the page (server returns 403 to non-owners); backend could add `role{id,title,owner_id}` and `assessment_version` to `AttemptReport` |
| 2026-11-17 | Edit a team member's name / locale (spec F10 "Edit") | No `PATCH /api/v1/team/users/{id}`; only list/get/create/deactivate/reactivate/reset-password/unlock/sign-out-everywhere exist | Edit not built; Team page offers the other actions. Needs backend change if editing is required |

Parked for phase 2 (do not build): live monitoring screen, contributor link, AI voice interviewer, sub-organizations, dark mode, extra UI languages, screen-share proctoring, platform-provided AI, automatic misuse alerts, per-organization login addresses.

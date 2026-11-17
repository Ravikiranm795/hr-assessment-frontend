# Working rules for this repo (read first)

Frontend for the HR Assessment Platform. Spec: `~/Downloads/HR-Assessment-Platform-Frontend-Master-Spec.md`
(do not re-read it on resume; the decisions you need are summarised in `docs/progress/CHECKPOINT.md`).
Backend repo (sibling folder): `/Users/apple/Documents/my works/hr portal/hr-assessment-backend` (docs in its `docs/` folder). Layout: `hr portal/` holds both `hr-assessment-backend/` and `HR assessment Frnd/` (this repo).

## 0. Resume rule
When the user says "continue": read **only** `docs/progress/CHECKPOINT.md`, set its status to RUNNING, and work from "Next 3 steps". Do not re-read the spec, handover docs or finished modules.

## 1. Analyse code with the brain, not file sweeps (mandatory)
- Use brain MCP tools (`brain_context`, `brain_search`, `brain_expand`, `brain_read`, `brain_check`, `brain_build`). If not available, use the CLI with Node 24 first on PATH:
  `PATH=/Users/apple/.nvm/versions/node/v24.20.0/bin:$PATH brain context "<task>"`
  (default `node` is v18 and crashes brain's sqlite module).
- Run `brain build` after **every module** (incremental, seconds).

## 2. Read and write files with Claude's own tools (mandatory)
- Read (with line ranges), Write, Edit. No `cat`/`sed`/`echo`/heredocs for file content. Bash only runs things (npm, vite, playwright, docker, git, brain). Tail long output (`| tail -n 30`).
- Never load all of `api/openapi.json` or `src/api-types/schema.d.ts`. Look up one operation at a time (`grep -n` a path in schema.d.ts, or brain).

## 3. Development-first, lean tests
- No tests while building a module. Quiet gate per module: `npm run typecheck` and `npm run lint`.
- Playwright only at the end of each of the 3 phases (`e2e/phase1|phase2|phase3`), once, `--reporter=line`, tailed; then one short visual look. Full suite once at the very end.
- 2 to 3 parallel agents max, on disjoint module folders; put rules 1 and 2 in every agent brief. Only the main thread edits `src/core` and `src/components`.

## 4. Commands (always Node 24)
`export PATH=/Users/apple/.nvm/versions/node/v24.20.0/bin:$PATH`
`npm run dev` (port 3000, proxies /api to :8000) | `npm run typecheck` | `npm run lint` | `npm run gen:api` (after a backend contract change) | `npm run e2e`

## 5. Rules of the contract
- Swagger/openapi (live at http://localhost:8000/docs) > backend FE-HANDOVER.md/error_codes.md > backend spec/MASTER-SPEC.md > frontend spec.
- If the backend has no API for something: do not invent it. Log in `docs/progress/API_GAPS.md` (parked / needs backend change) and move on.
- Access token in memory only. All visible text via `t('key')` from `src/locales/en.json`. Local commits only at phase ends / stop-and-save; never push.
- Budget: 80% usage = wrap-up (finish critical in-flight work only), 90% = stop, write CHECKPOINT.md, local commit.

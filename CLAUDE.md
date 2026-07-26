# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Jyo — a live, free community food-sharing app for Tirupati, India (households post leftover food, nearby students/neighbours request pickup, poster approves/rejects). No payment, no delivery. Two independent packages, no root `package.json`/workspace — `cd backend` or `cd frontend` before running any command.

## Commands

### Backend (`backend/`)

```bash
pnpm dev              # dev server, auto-reload (tsx watch)
pnpm build            # tsc -> dist/
pnpm start            # run compiled dist/index.js
pnpm test             # full lifecycle: docker-up test DB -> migrate -> vitest run -> docker-down
pnpm test:watch       # vitest watch mode — bring the test DB up first (see below), doesn't manage it for you
pnpm db:generate      # generate a Drizzle migration from schema.ts changes
pnpm db:migrate       # apply migrations to DATABASE_URL
pnpm db:studio        # browse the DB with Drizzle Studio
```

To run a single test file or test case without the full docker lifecycle:
```bash
pnpm test:db:up && pnpm test:db:migrate   # bring test DB up once, leave it running
pnpm exec vitest run tests/auth.test.ts
pnpm exec vitest run -t "rejects a wrong password"
pnpm test:db:down                          # when done
```
Tests run against `.env.test` (committed, dummy values only) on a disposable Postgres container (`docker-compose.test.yml`, port 5433) — fully isolated from the real `DATABASE_URL` in `.env`. Requires Docker running locally.

### Frontend (`frontend/`)

```bash
pnpm dev       # Vite dev server
pnpm build     # tsc -b && vite build
pnpm lint      # eslint .
pnpm preview   # serve the production build locally
```

No frontend test suite exists.

## Architecture

### Backend: routes never throw for expected failures

`app.ts` builds the Hono app (route mounting, CORS, request logging, the global `onError` handler) and is imported by both `index.ts` (the real server) and the test suite (`tests/*.test.ts` call `createApp()` directly via Hono's `.request()`, no real socket) — keeps test and prod wiring identical instead of a hand-maintained copy. `index.ts` adds only what's server-specific: `serve()`, cron job startup, graceful shutdown, Sentry init.

Route handlers return their own clean `c.json({error}, 4xx)` directly for expected failures (bad input, wrong password, unauthorized, not found) — they never `throw` for these. Anything that reaches `app.onError` is therefore *by construction* a genuine unexpected bug, which is what gets reported to Sentry there. Don't `throw` from a route for an expected condition; return the JSON response directly, matching the existing pattern.

### Concurrency: conditional-UPDATE-in-a-transaction guards state transitions

Every status-changing endpoint that can be hit twice (double-click, retry) — `approve`/`reject`/`cancel` in `requests.ts`, `complete` in `posts.ts` — uses the same pattern: a `db.transaction()` wrapping conditional `UPDATE ... WHERE id = X AND status = 'expected-current-status'` calls, checking `.returning()` for a match. If the WHERE clause matches zero rows (another request already changed it), a `ConflictError` (`lib/errors.ts`) is thrown to roll back and the route returns a clean "already processed" 400. `requests.ts`'s create-request handler established this pattern first (atomically claiming a post via conditional UPDATE); the others were retrofitted to match after a race-condition bug shipped once already. **If you add a new status-changing endpoint, use this same pattern** — a plain `select()` then separate `update()` with no status guard is the bug class this fixes.

`tests/requests-concurrency.test.ts` fires real concurrent requests at these endpoints and asserts exactly one wins — this is the regression suite for that bug class; extend it if you touch this logic.

### Post status lifecycle

`open` → `pending_approval` (request submitted) → `closed` (approved) → `completed`, or → `expired` (cron job, pickup window passed) at any point before `closed`. Exact pickup coordinates (`pickupLat`/`pickupLng`) are stripped from every response except to the poster or approved picker once `closed` — see `posts.ts`'s `/:id` and `/` (feed) handlers for the redaction pattern. Preserve this when adding new fields derived from location.

### Auth

JWT in an httpOnly cookie (`jose`, signed, 7-day expiry), verified in `middleware/auth.ts`. Login has a constant-time dummy bcrypt comparison against unknown emails (`DUMMY_PASSWORD_HASH` in `auth.ts`) specifically to prevent timing-based account enumeration — don't early-return before that comparison runs. Rate limiters (`middleware/limiters.ts`) are IP-keyed for unauthenticated endpoints, user-keyed for authenticated ones, and are **no-ops when `APP_ENV=test`** (no real socket in tests means no real IP for `getConnInfo`, and every test request would otherwise share one bucket and 429 unrelated tests).

### Frontend: TanStack Query for all server state

Every list/detail view and mutation goes through `@tanstack/react-query` (`main.tsx` sets up the `QueryClient`). `AuthContext` itself is backed by a query (`lib/queries/auth.ts`'s `authMeKey`/`fetchAuthMe`) rather than local state — `login()` seeds that query's cache directly (so route guards see the logged-in user immediately) then invalidates to backfill full profile data in the background; `Profile.tsx` reads/writes the *same* query key, which is why editing your name there updates the Navbar instantly. Follow this shared-query-key pattern for anything that needs to stay in sync across components, rather than prop-drilling or duplicating fetches.

Components are grouped by role, not just co-located: `components/ui/` (dumb primitives), `components/layout/` (app shell), `components/auth/` and `components/posts/` (feature-specific composites), mirrored in `pages/auth/` and `pages/posts/`. `Home.tsx`/`Profile.tsx`/`NotFound.tsx` stay flat at `pages/` root since they're standalone with no siblings.

### CI/CD — deploys are gated on tests passing, not on git push

`.github/workflows/ci.yml`: `backend` (spins up a Postgres service container, builds, migrates, runs vitest) and `frontend` (lint + build) run on every push/PR to `main`. Only on an actual push to `main`, and only if its job succeeded, `deploy-backend` (Render deploy hook) and `deploy-frontend` (`vercel deploy --prod` via CLI) run. Both platforms' own git-integration auto-deploy is disconnected — the GitHub Actions jobs are the only deploy trigger. `.github/workflows/codeql.yml` and `.github/workflows/backup.yml` (nightly `pg_dump`, needs `BACKUP_DATABASE_URL` secret — must be Supabase's *session pooler* string, not "Direct connection", which is IPv6-only and unreachable from the runner) round out the pipeline.

### Error tracking is opt-in and deliberately narrow

`@sentry/node` (backend) / `@sentry/react` (frontend) are no-ops unless `SENTRY_DSN`/`VITE_SENTRY_DSN` is set — nothing to configure for local dev or tests. Backend only reports at genuine-bug boundaries: `app.onError`, `uncaughtException`/`unhandledRejection`, and the two cron jobs' catch blocks — never for routes' own expected 4xx responses (that's normal traffic, not bugs, and would burn the error-tracking quota on noise). Follow the same principle if you add new Sentry capture points.

## How to work in this repo

- **This is a live production app with real users and real data** (accounts, locations, selfie photos). Treat every change accordingly: run `pnpm run build` (both packages) and `pnpm test` (backend) before considering any change done, not just when asked to verify. A change that looks obviously correct has still broken things here before (the `dist/src/index.js` vs `dist/index.js` deploy path bug shipped silently for a while before anyone noticed).
- Package manager is **pnpm**, not npm or yarn, in both packages — this has been corrected before when npm was used by mistake, which corrupts the lockfile relative to what's committed.
- **Branch per change, then a PR — never push directly to `main`.** `main` is branch-protected (requires a PR + passing CI status checks to merge). Create a short-lived branch (`git checkout -b fix/whatever`), commit, push the *branch*, then open a PR (no `gh` CLI here — either construct the compare URL `https://github.com/chandan-1427/jyo/compare/main...<branch>` for the user to open, or point out GitHub's own "Compare & pull request" banner after the branch push). Always confirm with the user before pushing or merging. Write commit messages that explain *why*, not just what changed (this repo's history leans on that for context later). Keep branches scoped to one coherent change and merge promptly — this repo follows trunk-based development (short-lived branches), not long-lived feature branches.
- Be proactive about production-readiness gaps (security, CI/CD, monitoring, dependency vulnerabilities, repo hygiene) instead of waiting to be asked — this repo's hardening so far (concurrency fixes, CI/CD, Sentry, Dependabot, CodeQL, backups) came from unprompted review, not a checklist the user already knew to ask for. The user has explicitly asked for this posture and has limited background in what a production app needs — explain *why* something matters as you go, don't just silently fix it.
- Before forcing a dependency major-version bump to silence a CVE, check whether the vulnerable code path is actually reachable given how this app uses that dependency (grep for the relevant APIs) — several advisories here (`@hono/node-server`'s serve-static-on-Windows path traversal, React Router's RSC-mode CSRF bypass) don't apply because this app doesn't use those features at all, and forcing the bump would trade a real breaking-change risk for closing a non-issue.
- No `gh` CLI or GitHub token is configured in this environment. To check a GitHub Actions run's status/conclusion, poll the public REST API directly (works for this public repo without auth): `curl -s https://api.github.com/repos/chandan-1427/jyo/actions/runs/<id>`. Raw job *logs* require an authenticated/admin token and aren't fetchable this way — ask the user to paste the relevant log section instead of guessing at a failure's cause.
- Docker must be running locally for `pnpm test` for the backend (spins up a disposable Postgres container) — if it's not running, ask the user to start Docker Desktop rather than trying to work around it.
- **Supabase's DB password is embedded in two separate places that must be updated together**: Render's `DATABASE_URL` (the live app's connection) and GitHub's `BACKUP_DATABASE_URL` secret (the nightly backup job). Resetting the Supabase password once already caused a live outage — every DB query failed with "password authentication failed" — because only the backup secret got updated, not Render's. If a password reset is ever needed again, update both immediately, not just whichever one prompted the reset.

## Notes

- `APP_ENV`, not `NODE_ENV`, gates production-only behavior (Tirupati 20km boundary enforcement, cookie `SameSite`/`secure` flags, rate-limiter bypass in tests) — check `env.ts` before adding a new environment-conditional.
- The two `.env.example` files and `backend/.env.test` document every environment variable each package needs; `backend/README.md` and `frontend/README.md` have the full setup/scripts/env-var reference per package. The root `README.md` covers only what's cross-cutting (what the app does, architecture, deployment, roadmap) — don't duplicate package-specific detail back into it.

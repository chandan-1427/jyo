# Jyo — Backend

Hono REST API for [Jyo](../README.md), a free community food-sharing app for Tirupati, India. See the [root README](../README.md) for what the app does, its architecture, deployment pipeline, and roadmap.

## Tech Stack

| Package | Purpose |
|---|---|
| Hono | HTTP framework |
| @hono/node-server | Node.js adapter for Hono |
| Drizzle ORM + postgres | Database ORM and driver |
| @supabase/supabase-js | File storage (Supabase Storage) |
| bcryptjs | Password hashing |
| jose | JWT signing and verification |
| resend | Transactional email |
| node-cron | Post-expiry and notification-cleanup schedulers |
| @sentry/node | Error tracking (optional) |
| vitest | Test runner |
| TypeScript | Type safety |

## Setup

```bash
cp .env.example .env
# fill in all values — see Environment Variables below
pnpm install
pnpm dev
```

Runs on `http://localhost:3000` by default.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server with auto-reload |
| `pnpm build` | Type-check and compile to `dist/` |
| `pnpm start` | Run the compiled build (`dist/index.js`) |
| `pnpm test` | Run the full test suite — spins up a disposable Postgres container via Docker, migrates it, runs vitest, tears it down |
| `pnpm test:watch` | Run vitest in watch mode (assumes the test DB is already up — see below) |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply migrations to the database in `DATABASE_URL` |
| `pnpm db:push` | Push schema changes directly without a migration file (dev convenience only) |
| `pnpm db:studio` | Open Drizzle Studio to browse the database |

### Running tests without the full `pnpm test` lifecycle

`pnpm test` handles the test database automatically via Docker, but if you're iterating with `pnpm test:watch`, bring the DB up first and leave it running:

```bash
pnpm test:db:up       # starts the disposable Postgres container
pnpm test:db:migrate  # applies migrations to it
pnpm test:watch
pnpm test:db:down     # when you're done
```

The test suite runs against `.env.test` (committed — it's all dummy/test-only values, never real secrets), completely isolated from whatever `DATABASE_URL` is in your real `.env`.

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `PORT` | Port the server listens on | Set to `3000` or any free port |
| `APP_ENV` | Environment mode (`development` or `production`) | Set manually |
| `DATABASE_URL` | PostgreSQL connection string | Supabase project → Settings → Database |
| `JWT_SECRET` | Secret used to sign JWTs | Generate a strong random string |
| `CLIENT_URL` | Frontend URL for CORS | Your frontend URL or `http://localhost:5173` |
| `APP_URL` | Public URL of the app used in email links | Your frontend URL or `http://localhost:5173` |
| `SUPABASE_URL` | Supabase project URL | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Supabase project → Settings → API |
| `RESEND_API_KEY` | API key for sending emails | Resend dashboard |
| `SENTRY_DSN` | Error tracking (optional — omit to disable) | Sentry project → Settings → Client Keys (DSN) |

## Database Backups

Supabase's free tier does not include automatic backups — a bad migration or an accidental delete has no way back without one. `.github/workflows/backup.yml` runs a `pg_dump` against the database every night at 03:00 UTC and stores the result as a GitHub Actions artifact (kept for 30 days). You can also trigger it on demand from the Actions tab (`Database Backup` → `Run workflow`).

### One-time setup

1. In Supabase: **Settings → Database → Connection string**, copy the **Session pooler** string — not "Direct connection". Supabase's direct connection is IPv6-only, and GitHub Actions runners are IPv4-only, so `pg_dump` fails with "Network is unreachable" against it. The session pooler supports the session-level operations `pg_dump` needs and works over IPv4.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name it `BACKUP_DATABASE_URL`, paste that connection string.

That's it — the workflow picks it up automatically on its next scheduled run.

### Restoring from a backup

1. Download the `.dump` file from the relevant workflow run's Artifacts section (Actions tab → the run → scroll to Artifacts).
2. Restore it into a database with `pg_restore`:
   ```bash
   pg_restore --no-owner --clean --if-exists -d "<connection-string>" backup.dump
   ```
   `--clean --if-exists` drops existing objects before recreating them from the dump — point this at a fresh/throwaway database first if you're unsure, not directly at production, unless you're intentionally rolling back.

## Project Structure

```
src/
├── db/           # Drizzle schema and database client
├── routes/       # Hono route handlers (auth, users, posts, requests, notifications)
├── middleware/   # Auth, rate limiting, request logging
├── lib/          # Utilities: haversine distance, mailer, notifications, storage, errors
├── jobs/         # Cron jobs (post expiry, notification cleanup)
├── app.ts        # App/route construction — shared by index.ts and the test suite
├── instrument.ts # Sentry initialization (must load first)
└── index.ts      # Entry point: starts the server, cron jobs, graceful shutdown

tests/            # Integration tests (routes, concurrency guards) — see helpers/ for shared setup
```

## Post Status Lifecycle

| Status | Meaning |
|---|---|
| `open` | Post is active and visible in the feed. Anyone nearby can request it. |
| `pending_approval` | A picker has submitted a request. The poster is reviewing it. The post is no longer available to others. |
| `closed` | The poster approved a request. The exact pickup location is now shared with the approved picker. |
| `completed` | The poster confirmed the food was picked up successfully. |
| `expired` | The pickup window passed before the post was closed or completed. Set automatically by the expiry cron job. |

For deployment, CI/CD, and the overall system architecture, see the [root README](../README.md).

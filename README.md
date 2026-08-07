# Jyo - Food Sharing

Free community food sharing for Tirupati, India.

[![Live](https://img.shields.io/badge/Live-jyo.co.in-2D6A4F?style=flat-square)](https://www.jyo.co.in)
[![CI](https://github.com/chandan-1427/jyo/actions/workflows/ci.yml/badge.svg)](https://github.com/chandan-1427/jyo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![Built for Tirupati](https://img.shields.io/badge/Built%20for-Tirupati%20%F0%9F%87%AE%F0%9F%87%B3-orange?style=flat-square)](https://www.jyo.co.in)

<p align="center">
  <img src="frontend/public/og-image.png" alt="Jyo — Community food sharing for Tirupati" width="100%" />
</p>

## What is Jyo

Jyo is a web app that connects households with leftover food to students and neighbours nearby in Tirupati. Someone posts food they can't finish, someone close by requests to pick it up, and the poster approves or rejects. No delivery, no payment, no middleman — just neighbours helping neighbours. It was built as a social service with no commercial motive by a recent SVCE graduate who wanted to do something useful for the city.

## Features

- GPS-based feed — shows only food posts within 20 km of your location
- Privacy-preserving location — exact coordinates are hidden from the feed; only the approved picker sees the location after approval
- Selfie verification — pickers submit a selfie photo when requesting a pickup, so the poster knows who is coming
- Post status lifecycle — posts move through a defined set of states from open to completed (or expired)
- Automatic expiry — a cron job runs every 5 minutes and marks posts as expired once their pickup window ends
- In-app notifications — both posters and pickers are notified when request status changes
- Email notifications — transactional emails for account verification, password reset, request received, approved, and rejected via Resend
- Tirupati boundary enforcement — posting and requesting is restricted to within 20 km of Tirupati center in production

## Tech Stack

### Frontend

| Package | Version | Purpose |
|---|---|---|
| React | ^19.2.5 | UI framework |
| React Router DOM | ^7.15.0 | Client-side routing |
| TanStack Query | ^5.101.4 | Server-state caching and mutations |
| Tailwind CSS | ^4.3.0 | Styling |
| @supabase/supabase-js | ^2.105.4 | Auth session (Supabase client) |
| @sentry/react | ^10.68.0 | Error tracking (optional) |
| lucide-react | ^1.14.0 | Icons |
| clsx | ^2.1.1 | Conditional classnames |
| tailwind-merge | ^3.6.0 | Tailwind class merging |
| Vite | ^8.0.10 | Build tool |
| TypeScript | ~6.0.2 | Type safety |

### Backend

| Package | Version | Purpose |
|---|---|---|
| Hono | ^4.12.32 | HTTP framework |
| @hono/node-server | ^1.19.14 | Node.js adapter for Hono |
| Drizzle ORM | ^0.45.2 | Database ORM |
| postgres | ^3.4.9 | PostgreSQL driver |
| @supabase/supabase-js | ^2.105.4 | File storage (Supabase client) |
| bcryptjs | ^3.0.3 | Password hashing |
| jose | ^6.2.3 | JWT signing and verification |
| resend | ^6.12.3 | Transactional email |
| node-cron | ^4.2.1 | Post expiry and notification-cleanup schedulers |
| @sentry/node | ^10.68.0 | Error tracking (optional) |
| vitest | ^4.1.10 | Test runner |
| TypeScript | ^5.8.3 | Type safety |
| tsx | ^4.7.1 | Dev server runner |

## Architecture Overview

The frontend is a React SPA deployed on Vercel, talking to a Hono REST API deployed on Render. The database is a PostgreSQL instance hosted on Supabase, accessed through Drizzle ORM. File uploads (food photos and selfie verifications) go directly to Supabase Storage buckets. Transactional and notification emails are sent through Resend. Authentication is handled with HTTP-only cookies carrying a JWT signed with `jose`. Errors on both sides are reported to Sentry (optional — no-op if unconfigured). DNS is managed on Cloudflare, with the live domain at `jyo.co.in`.

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm
- Docker (only needed to run the backend test suite)

### Clone

```bash
git clone https://github.com/chandan-1427/jyo.git
cd jyo
```

Backend and frontend each have their own setup, scripts, and environment variable reference in their own README:

- [backend/README.md](./backend/README.md) — setup, scripts, tests, env vars
- [frontend/README.md](./frontend/README.md) — setup, scripts, env vars

## Project Structure

```
jyo/
├── backend/   # Hono REST API — see backend/README.md for its internal structure
├── frontend/  # React SPA — see frontend/README.md for its internal structure
└── .github/   # CI/CD workflow (test, build, gated deploy to Render/Vercel)
```

## Post Status Lifecycle

| Status | Meaning |
|---|---|
| `open` | Post is active and visible in the feed. Anyone nearby can request it. |
| `pending_approval` | A picker has submitted a request. The poster is reviewing it. The post is no longer available to others. |
| `closed` | The poster approved a request. The exact pickup location is now shared with the approved picker. |
| `completed` | The poster confirmed the food was picked up successfully. |
| `expired` | The pickup window passed before the post was closed or completed. Set automatically by the expiry cron job. |

## Deployment

Deploys are driven entirely by CI, not by Render/Vercel's own git integrations — a broken build or failing test blocks the deploy instead of shipping anyway.

- **CI/CD**: `.github/workflows/ci.yml` runs on every push/PR to `main`. The `backend` job spins up a disposable Postgres container, builds, migrates, and runs the full test suite; the `frontend` job lints and builds. Only on an actual push to `main`, and only if its corresponding job passed, `deploy-backend` and `deploy-frontend` jobs run.
- **Backend**: hosted on Render as a web service (start command `node dist/index.js`, built with `tsc`). `deploy-backend` triggers Render's deploy hook (`RENDER_DEPLOY_HOOK_URL` secret) — Render then pulls the latest commit and builds/deploys on its own infrastructure. Auto-deploy-on-push is disabled in the Render dashboard so this hook is the only trigger.
- **Frontend**: hosted on Vercel. `deploy-frontend` runs `vercel deploy --prod` using `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets, which uploads the source and builds it on Vercel's own infrastructure — functionally the same as the old git-integration auto-deploy, just triggered by CI passing instead of a raw push. The GitHub integration in Vercel is disconnected so it can't double-deploy independently of CI.
- **Database and Storage**: both on Supabase. Create a project, run migrations with `pnpm db:migrate`, and create two storage buckets named `food-photos` and `selfies` with public access.

## Adapting for Your City

If you want to run this for your own city, fork the repo and make these changes:

1. In `backend/src/lib/haversine.ts`, update `TIRUPATI_CENTER` to the coordinates of your city and adjust `TIRUPATI_RADIUS_KM` to cover the area you want to serve.
2. Update the `APP_URL` and `CLIENT_URL` environment variables to your deployment URLs.
3. Update the allowed CORS origins in `backend/src/app.ts` to match your domain.
4. Replace the branding (app name, email sender, etc.) as needed.

That is essentially it. The rest of the app is city-agnostic.

## Roadmap

- Phone OTP verification as an alternative to email
- In-app chat between poster and picker after approval
- Food category filters in the feed
- Trust scores for repeat users
- Multi-city expansion
- Admin dashboard for moderation

## Contributing

Feedback and bug reports are welcome via [GitHub Issues](https://github.com/chandan-1427/jyo/issues). Not actively seeking code contributions at this time, but forks are encouraged.

## License

MIT — see [LICENSE](./LICENSE).

## Author

Built by Chandan — [GitHub](https://github.com/chandan-1427) · [jyo.co.in](https://www.jyo.co.in)

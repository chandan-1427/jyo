# Jyo

Free community food sharing for Tirupati, India.

[![Live](https://img.shields.io/badge/Live-jyo.co.in-2D6A4F?style=flat-square)](https://www.jyo.co.in)
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
| Tailwind CSS | ^4.3.0 | Styling |
| @supabase/supabase-js | ^2.105.4 | Auth session (Supabase client) |
| lucide-react | ^1.14.0 | Icons |
| clsx | ^2.1.1 | Conditional classnames |
| tailwind-merge | ^3.6.0 | Tailwind class merging |
| Vite | ^8.0.10 | Build tool |
| TypeScript | ~6.0.2 | Type safety |

### Backend

| Package | Version | Purpose |
|---|---|---|
| Hono | ^4.12.18 | HTTP framework |
| @hono/node-server | ^1.19.14 | Node.js adapter for Hono |
| Drizzle ORM | ^0.45.2 | Database ORM |
| postgres | ^3.4.9 | PostgreSQL driver |
| @supabase/supabase-js | ^2.105.4 | File storage (Supabase client) |
| bcryptjs | ^3.0.3 | Password hashing |
| jose | ^6.2.3 | JWT signing and verification |
| resend | ^6.12.3 | Transactional email |
| node-cron | ^4.2.1 | Post expiry scheduler |
| TypeScript | ^5.8.3 | Type safety |
| tsx | ^4.7.1 | Dev server runner |

## Architecture Overview

The frontend is a React SPA deployed on Vercel, talking to a Hono REST API deployed on Render. The database is a PostgreSQL instance hosted on Supabase, accessed through Drizzle ORM. File uploads (food photos and selfie verifications) go directly to Supabase Storage buckets. Transactional and notification emails are sent through Resend. Authentication is handled with HTTP-only cookies carrying a JWT signed with `jose`. DNS is managed on Cloudflare, with the live domain at `jyo.co.in`.

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm

### Clone

```bash
git clone https://github.com/chandan-1427/jyo.git
cd jyo
```

### Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env (see Environment Variables below)
pnpm install
pnpm dev
```

The backend runs on `http://localhost:3000` by default.

To run database migrations:

```bash
pnpm db:migrate
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Fill in all values in .env (see Environment Variables below)
pnpm install
pnpm dev
```

The frontend runs on `http://localhost:5173` by default.

## Environment Variables

### Backend (`backend/.env`)

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

### Frontend (`frontend/.env`)

| Variable | Description | Where to get it |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | Your backend URL or `http://localhost:3000` |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key | Supabase project → Settings → API |
| `VITE_APP_ENV` | Environment mode (`development` or `production`) | Set manually |

## Project Structure

```
backend/src/
├── db/          # Drizzle schema and database client
├── routes/      # Hono route handlers (auth, users, posts, requests, notifications)
├── middleware/  # JWT auth middleware
├── lib/         # Utilities: haversine distance, mailer, notifications, storage
├── jobs/        # Cron jobs (post expiry scheduler)
└── index.ts     # App entry point, server setup, CORS config

frontend/src/
├── pages/       # Route-level page components
├── components/  # Shared components (Navbar, PostCard, RequestModal, etc.)
│   └── ui/      # Low-level UI primitives (Input, Field, Button, Badge, etc.)
├── context/     # React context (AuthContext)
├── lib/         # API client, utilities, Supabase client, location helpers
└── types/       # TypeScript types for API responses
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

- Frontend: deployed on Vercel. Connect your GitHub repo and Vercel handles the rest. Set `VITE_*` environment variables in the Vercel project settings.
- Backend: deployed on Render as a web service. Set the backend environment variables in the Render dashboard. The start command is `node dist/index.js` after running `tsc` to build.
- Database and Storage: both on Supabase. Create a project, run migrations with `pnpm db:migrate`, and create two storage buckets named `food-photos` and `selfies` with public access.

## Adapting for Your City

If you want to run this for your own city, fork the repo and make these changes:

1. In `backend/src/lib/haversine.ts`, update `TIRUPATI_CENTER` to the coordinates of your city and adjust `TIRUPATI_RADIUS_KM` to cover the area you want to serve.
2. Update the `APP_URL` and `CLIENT_URL` environment variables to your deployment URLs.
3. Update the allowed CORS origins in `backend/src/index.ts` to match your domain.
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

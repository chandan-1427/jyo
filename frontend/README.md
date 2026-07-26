# Jyo — Frontend

React SPA for [Jyo](../README.md), a free community food-sharing app for Tirupati, India. See the [root README](../README.md) for what the app does, its architecture, deployment pipeline, and roadmap.

## Tech Stack

| Package | Purpose |
|---|---|
| React + React Router DOM | UI framework and client-side routing |
| TanStack Query | Server-state caching and mutations |
| Tailwind CSS | Styling |
| @supabase/supabase-js | Auth session + realtime notifications |
| @sentry/react | Error tracking (optional) |
| lucide-react | Icons |
| clsx + tailwind-merge | Conditional/merged classnames |
| Vite | Build tool |
| TypeScript | Type safety |

## Setup

```bash
cp .env.example .env
# fill in all values — see Environment Variables below
pnpm install
pnpm dev
```

Runs on `http://localhost:5173` by default.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Vite dev server |
| `pnpm build` | Type-check (`tsc -b`) and build for production |
| `pnpm lint` | Run eslint |
| `pnpm preview` | Serve the production build locally |

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | Your backend URL or `http://localhost:3000` |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key | Supabase project → Settings → API |
| `VITE_APP_ENV` | Environment mode (`development` or `production`) | Set manually |
| `VITE_SENTRY_DSN` | Error tracking (optional — omit to disable) | Sentry project → Settings → Client Keys (DSN) |

## Project Structure

```
src/
├── pages/       # Route-level page components (grouped by feature: auth/, posts/)
├── components/  # Shared components
│   ├── ui/      # Low-level UI primitives (Input, Field, Button, Badge, etc.)
│   ├── layout/  # App shell (Navbar, Layout, SplashScreen, ErrorFallback)
│   ├── auth/    # Auth-page-specific composites
│   └── posts/   # Post/feed-specific composites (PostCard, RequestModal)
├── context/     # React context (AuthContext)
├── lib/         # API client, TanStack Query setup, Supabase client, location helpers, Sentry init
└── types/       # TypeScript types for API responses
```

For deployment, CI/CD, and the overall system architecture, see the [root README](../README.md).

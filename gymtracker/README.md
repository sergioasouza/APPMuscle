# GymTracker

GymTracker is a mobile-first workout tracker built with Next.js App Router, Supabase, Tailwind CSS, and `next-intl`.

## Product highlights

- workout creation and exercise library
- weekly workout scheduling
- daily training flow with session notes
- analytics by workout
- calendar history view
- locale switching (`en` / `pt`)
- offline queue for pending set sync on the `today` screen

## Tech stack

- Next.js 16
- React 19
- Supabase SSR
- Tailwind CSS 4
- `next-intl`
- `next-themes`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.local.example .env.local
```

3. Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

4. Run the app:

```bash
npm run dev
```

If your local environment hits a Turbopack cache/lock issue, use:

```bash
npm run dev:stable
```

## Quality checks

```bash
npm run lint
npm run build
```

## Database

The current safe migration for production data is in:

- [supabase/migrations/20260306_phase1_preserve_existing_data.sql](supabase/migrations/20260306_phase1_preserve_existing_data.sql)
- [supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql](supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql)

Reference docs:

- [docs/database/phase-1-safe-migration.md](docs/database/phase-1-safe-migration.md)

## Deploy today

Recommended path: Vercel + Supabase.

### Option A (recommended): Vercel

Use this when you want the fastest and safest production path for this Next.js app.

1. In Vercel, either:
	- update your existing project to this repository/branch, or
	- create a new Vercel project from the same repository (good for staging first).
2. Add the environment variables from `.env.local.example`.
3. Set `NEXT_PUBLIC_SITE_URL` to the final production domain of that Vercel project.
4. In Supabase Auth URL settings, add the same production URL to allowed redirect URLs.
5. Deploy.

Practical rollout suggestion:

- create a new Vercel project first,
- validate with your account switching and workout flows,
- then move your main domain to it.

### Option B: DigitalOcean VPS

Use this if you want full server control and are ready to operate Node/PM2/Nginx yourself.

High-level flow:

1. Build and run `next start` behind Nginx (or Docker).
2. Configure SSL, process manager (PM2/systemd), and logs.
3. Set the same env vars and Supabase redirect URLs.

For this project, VPS is viable, but Vercel is lower operational risk for immediate go-live.

### Supabase

Before going live, confirm production has the expected schema and run the safe migration if needed.

### Go-live checklist

Use:

- [docs/deployment/go-live-checklist.md](docs/deployment/go-live-checklist.md)

## Main routes

- `/login`
- `/today`
- `/workouts`
- `/schedule`
- `/calendar`
- `/analytics`
- `/profile`

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

## Quality checks

```bash
npm run lint
npm run build
```

## Database

The current safe migration for production data is in:

- [supabase/migrations/20260306_phase1_preserve_existing_data.sql](supabase/migrations/20260306_phase1_preserve_existing_data.sql)

Reference docs:

- [docs/database/phase-1-safe-migration.md](docs/database/phase-1-safe-migration.md)

## Deploy today

Recommended path: Vercel + Supabase.

### Vercel

1. Import the repository.
2. Add the environment variables from `.env.local.example`.
3. Set `NEXT_PUBLIC_SITE_URL` to the final production domain.
4. Deploy.

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

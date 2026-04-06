# GymTracker

GymTracker is a mobile-first workout tracker built with Next.js App Router, Supabase, Tailwind CSS, and `next-intl`.

## Product highlights

- public landing page, privacy policy, and terms page
- admin backoffice for users, billing, and base exercise catalog
- workout creation and exercise library
- system exercise catalog with per-user overrides
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
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONTACT_WHATSAPP_URL`
- `NEXT_PUBLIC_CONTACT_EMAIL`

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
npm run typecheck
npm test
npm run lint -- .
npm run build
```

## Database

The current required migration baseline for production is:

- [supabase/migrations/20260306_phase1_preserve_existing_data.sql](supabase/migrations/20260306_phase1_preserve_existing_data.sql)
- [supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql](supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql)
- [supabase/migrations/20260315_add_archived_at_to_exercises.sql](supabase/migrations/20260315_add_archived_at_to_exercises.sql)
- [supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql](supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql)
- [supabase/migrations/20260405_add_system_exercises_and_overrides.sql](supabase/migrations/20260405_add_system_exercises_and_overrides.sql)
- [supabase/migrations/20260406_seed_system_exercises_catalog.sql](supabase/migrations/20260406_seed_system_exercises_catalog.sql)
- [supabase/migrations/20260410_add_admin_access_manual_billing.sql](supabase/migrations/20260410_add_admin_access_manual_billing.sql)

Reference docs:

- [docs/database/phase-1-safe-migration.md](docs/database/phase-1-safe-migration.md)

Required schema for the current app version includes:

- `profiles.rotation_anchor_date`
- `profiles.role`
- `profiles.access_status`
- `profiles.paid_until`
- `profiles.must_change_password`
- `exercises.archived_at`
- `exercises.is_system`
- `exercises.modality`
- `exercises.muscle_group`
- `exercise_overrides`
- `schedule_rotations`
- `body_measurements`
- `manual_billing_events`
- `admin_audit_log`

## Admin bootstrap

After applying the full migration baseline, create the first admin with:

```bash
npm run bootstrap:admin -- --email admin@your-domain.com --password "Temporary123" --name "GymTracker Admin"
```

The admin account lands in `/admin`. Member accounts land in `/today` only when access is active and the paid date is still valid.

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

Before going live, confirm production has the expected schema and run the full migration baseline if needed.

### Go-live checklist

Use:

- [docs/deployment/go-live-checklist.md](docs/deployment/go-live-checklist.md)

## Main routes

- `/`
- `/login`
- `/privacy`
- `/terms`
- `/blocked`
- `/auth/change-password`
- `/admin`
- `/admin/users`
- `/admin/exercises`
- `/today`
- `/workouts`
- `/schedule`
- `/calendar`
- `/analytics`
- `/profile`

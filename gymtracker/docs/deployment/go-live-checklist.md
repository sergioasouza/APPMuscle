# GymTracker go-live checklist

## 1. Supabase

- Confirm `profiles`, `workouts`, `schedule`, `workout_sessions`, `workout_exercises`, `set_logs`, and `exercises` exist in production.
- Run the safe migration already created in [supabase/migrations/20260306_phase1_preserve_existing_data.sql](../../supabase/migrations/20260306_phase1_preserve_existing_data.sql).
- Verify RLS policies are enabled in production.
- Create at least one real test user in production.

## 2. Environment variables

Configure these variables in the hosting provider:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

## 3. Deployment smoke test

- Sign in from desktop.
- Sign in from mobile.
- Create a workout.
- Assign it in schedule.
- Log a workout in `today`.
- Turn the device offline and save one set.
- Reconnect and confirm the pending set syncs.
- Open analytics and confirm the session appears.

## 4. PWA checks

- Open the app on mobile.
- Confirm install prompt / add-to-home-screen works.
- Confirm icon and theme color render correctly.
- Confirm the app opens to `/today` after installation.

## 5. Release decision

Launch only after:

- `npm run lint` passes
- `npm run build` passes
- production login works
- production writes succeed in Supabase

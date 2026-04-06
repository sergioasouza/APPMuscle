# GymTracker go-live checklist

## 1. Supabase

- Confirm `profiles`, `workouts`, `schedule`, `schedule_rotations`, `workout_sessions`, `workout_exercises`, `set_logs`, `exercises`, and `body_measurements` exist in production.
- Confirm `profiles.rotation_anchor_date` and `exercises.archived_at` exist in production.
- Run the migration baseline in this order:
  - [supabase/migrations/20260306_phase1_preserve_existing_data.sql](../../supabase/migrations/20260306_phase1_preserve_existing_data.sql)
  - [supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql](../../supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql)
  - [supabase/migrations/20260315_add_archived_at_to_exercises.sql](../../supabase/migrations/20260315_add_archived_at_to_exercises.sql)
  - [supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql](../../supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql)
- Verify RLS policies are enabled in production.
- Verify the `on_auth_user_created` trigger is active and new signups create a `profiles` row automatically.
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
- Reschedule a planned workout and confirm both origin and destination render correctly.
- Turn the device offline and save one set.
- Reconnect and confirm the pending set syncs.
- Open analytics and confirm the session appears.
- Open calendar and confirm weekly adherence/volume summaries load.
- Open profile and confirm body metrics charts load without schema errors.

## 4. PWA checks

- Open the app on mobile.
- Confirm install prompt / add-to-home-screen works.
- Confirm icon and theme color render correctly.
- Confirm the app opens to `/today` after installation.

## 5. Release decision

Launch only after:

- `npm exec tsc --noEmit` passes
- `npm test` passes
- `npm run lint` passes
- `npm run build` passes
- production login works
- production writes succeed in Supabase
- Confirm `NEXT_PUBLIC_CONTACT_WHATSAPP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL`.
- Apply the admin/access migration `20260410_add_admin_access_manual_billing.sql`.
- Bootstrap the first admin with `npm run bootstrap:admin -- --email ... --password ... --name ...`.
- Disable public signup in Supabase Auth and keep password recovery enabled.
- Configure the reset password redirect to `/auth/callback?next=/auth/change-password`.
- Run `npm run typecheck`, `npm test`, `npm run lint -- .`, and `npm run build`.
- Review `/`, `/privacy`, `/terms`, `/login`, `/blocked`, and `/admin` before production cutover.

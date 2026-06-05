# GymTracker go-live checklist

## 1. Supabase

- Confirm `profiles`, `workouts`, `schedule`, `schedule_rotations`, `workout_sessions`, `workout_exercises`, `set_logs`, `exercises`, `exercise_overrides`, `body_measurements`, `manual_billing_events`, `admin_audit_log`, `workout_cardio_blocks`, `session_cardio_logs`, `session_cardio_intervals`, `session_exercise_skips`, `session_exercise_substitutions`, and `session_exercise_targets` exist in production.
- Confirm `profiles.rotation_anchor_date`, `profiles.member_access_mode`, `profiles.billing_day_of_month`, `profiles.billing_grace_business_days`, `profiles.trial_ends_at`, and `exercises.archived_at` exist in production.
- Run the migration baseline in this order:
  - [supabase/migrations/20260306_phase1_preserve_existing_data.sql](../../supabase/migrations/20260306_phase1_preserve_existing_data.sql)
  - [supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql](../../supabase/migrations/20260307_fix_missing_profiles_and_auth_trigger.sql)
  - [supabase/migrations/20260315_add_archived_at_to_exercises.sql](../../supabase/migrations/20260315_add_archived_at_to_exercises.sql)
  - [supabase/migrations/20260315_unique_session_per_day.sql](../../supabase/migrations/20260315_unique_session_per_day.sql)
  - [supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql](../../supabase/migrations/20260402_add_body_metrics_and_schedule_rotations.sql)
  - [supabase/migrations/20260405_add_system_exercises_and_overrides.sql](../../supabase/migrations/20260405_add_system_exercises_and_overrides.sql)
  - [supabase/migrations/20260406_seed_system_exercises_catalog.sql](../../supabase/migrations/20260406_seed_system_exercises_catalog.sql)
  - [supabase/migrations/20260407_repair_legacy_system_catalog_aliases.sql](../../supabase/migrations/20260407_repair_legacy_system_catalog_aliases.sql)
  - [supabase/migrations/20260408_reconcile_remaining_legacy_system_exercises.sql](../../supabase/migrations/20260408_reconcile_remaining_legacy_system_exercises.sql)
  - [supabase/migrations/20260409_add_cardio_and_session_exercise_skips.sql](../../supabase/migrations/20260409_add_cardio_and_session_exercise_skips.sql)
  - [supabase/migrations/20260410_add_admin_access_manual_billing.sql](../../supabase/migrations/20260410_add_admin_access_manual_billing.sql)
  - [supabase/migrations/20260411_repair_profile_defaults_and_auth_trigger.sql](../../supabase/migrations/20260411_repair_profile_defaults_and_auth_trigger.sql)
  - [supabase/migrations/20260412_add_member_access_modes_and_trial_support.sql](../../supabase/migrations/20260412_add_member_access_modes_and_trial_support.sql)
  - [supabase/migrations/20260413_add_session_exercise_substitutions.sql](../../supabase/migrations/20260413_add_session_exercise_substitutions.sql)
  - [supabase/migrations/20260419_add_session_exercise_targets.sql](../../supabase/migrations/20260419_add_session_exercise_targets.sql)
- Verify RLS policies are enabled in production.
- Verify the `on_auth_user_created` trigger is active and new signups create a `profiles` row automatically.
- Create at least one real test user in production.

## 2. Environment variables

Configure these variables in the hosting provider:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `APP_TIMEZONE`
- `NEXT_PUBLIC_CONTACT_WHATSAPP_URL`
- `NEXT_PUBLIC_CONTACT_EMAIL`

Optional but supported:

- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_CSP_REPORT_URI`

For authenticated E2E runs:

- `E2E_BASE_URL`
- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_TARGET_MEMBER_EMAIL`

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
- Open admin users and confirm expired trials are shown as blocked/expired, not deleted automatically.
- Reset another user's temporary password from admin and confirm the audit log records it.

## 4. PWA checks

- Open the app on mobile.
- Confirm install prompt / add-to-home-screen works.
- Confirm icon and theme color render correctly.
- Confirm the app opens to `/today` after installation.

## 5. Release decision

Launch only after:

- `npm run typecheck` passes
- `npm test` passes
- `npm run test:coverage` passes
- `npm run lint -- .` passes
- `npm run build` passes
- `npm audit --audit-level=moderate` passes
- `npm run test:e2e:public` passes
- `npm run test:e2e:auth` passes when `E2E_*` credentials are configured
- production login works
- production writes succeed in Supabase
- Confirm `NEXT_PUBLIC_CONTACT_WHATSAPP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_TIMEZONE`, and `NEXT_PUBLIC_SITE_URL`.
- Apply the complete migration baseline through `20260419_add_session_exercise_targets.sql`.
- Bootstrap the first admin with `npm run bootstrap:admin -- --email ... --password ... --name ...`.
- Disable public signup in Supabase Auth and keep password recovery enabled.
- Configure the reset password redirect to `/auth/callback?next=/auth/change-password`.
- Run `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run lint -- .`, `npm run build`, and `npm audit --audit-level=moderate`.
- Review `/`, `/privacy`, `/terms`, `/login`, `/blocked`, and `/admin` before production cutover.

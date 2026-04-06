BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_access_mode TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS billing_day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS billing_grace_business_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ends_at DATE;

UPDATE public.profiles
SET
  member_access_mode = CASE
    WHEN role = 'admin' THEN 'internal'
    ELSE 'internal'
  END,
  billing_grace_business_days = COALESCE(billing_grace_business_days, 0)
WHERE
  member_access_mode IS NULL
  OR member_access_mode NOT IN ('internal', 'billable', 'trial')
  OR billing_grace_business_days IS NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_member_access_mode_check,
  DROP CONSTRAINT IF EXISTS profiles_billing_day_of_month_check,
  DROP CONSTRAINT IF EXISTS profiles_billing_grace_business_days_check,
  DROP CONSTRAINT IF EXISTS profiles_trial_configuration_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_member_access_mode_check
    CHECK (member_access_mode IN ('internal', 'billable', 'trial')),
  ADD CONSTRAINT profiles_billing_day_of_month_check
    CHECK (billing_day_of_month IS NULL OR billing_day_of_month BETWEEN 1 AND 31),
  ADD CONSTRAINT profiles_billing_grace_business_days_check
    CHECK (billing_grace_business_days >= 0 AND billing_grace_business_days <= 10),
  ADD CONSTRAINT profiles_trial_configuration_check
    CHECK (
      (member_access_mode = 'trial' AND trial_ends_at IS NOT NULL)
      OR (member_access_mode <> 'trial')
    );

CREATE INDEX IF NOT EXISTS idx_profiles_member_access_mode
  ON public.profiles (member_access_mode, access_status);

CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at
  ON public.profiles (trial_ends_at)
  WHERE member_access_mode = 'trial';

COMMIT;

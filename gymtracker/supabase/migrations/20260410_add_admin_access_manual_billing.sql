BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS paid_until DATE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.profiles
SET
  role = CASE
    WHEN lower(btrim(COALESCE(role, ''))) = 'admin' THEN 'admin'
    WHEN lower(btrim(COALESCE(role, ''))) IN (
      'member',
      'user',
      'aluno',
      'client',
      'cliente'
    ) THEN 'member'
    ELSE 'member'
  END,
  access_status = CASE
    WHEN lower(btrim(COALESCE(access_status, ''))) IN (
      'blocked',
      'inactive',
      'disabled',
      'suspended',
      'bloqueado',
      'inativo'
    ) THEN 'blocked'
    ELSE 'active'
  END,
  paid_until = COALESCE(paid_until, CURRENT_DATE + INTERVAL '365 days'),
  must_change_password = COALESCE(must_change_password, FALSE),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  paid_until IS NULL
  OR role IS NULL
  OR lower(btrim(COALESCE(role, ''))) NOT IN ('member', 'admin')
  OR access_status IS NULL
  OR lower(btrim(COALESCE(access_status, ''))) NOT IN ('active', 'blocked')
  OR must_change_password IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('member', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_access_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_access_status_check
      CHECK (access_status IN ('active', 'blocked'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE INDEX IF NOT EXISTS idx_profiles_role_access
  ON public.profiles (role, access_status);

CREATE INDEX IF NOT EXISTS idx_profiles_paid_until
  ON public.profiles (paid_until);

CREATE TABLE IF NOT EXISTS public.manual_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_billing_events_user_month_key UNIQUE (user_id, reference_month)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manual_billing_events_status_check'
  ) THEN
    ALTER TABLE public.manual_billing_events
      ADD CONSTRAINT manual_billing_events_status_check
      CHECK (status IN ('paid', 'unpaid', 'waived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manual_billing_events_reference_month_check'
  ) THEN
    ALTER TABLE public.manual_billing_events
      ADD CONSTRAINT manual_billing_events_reference_month_check
      CHECK (
        reference_month = date_trunc('month', reference_month::timestamp)::date
      );
  END IF;
END $$;

ALTER TABLE public.manual_billing_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_manual_billing_events_user_month
  ON public.manual_billing_events (user_id, reference_month DESC);

CREATE INDEX IF NOT EXISTS idx_manual_billing_events_recorded_by
  ON public.manual_billing_events (recorded_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_audit_log_entity_type_check'
  ) THEN
    ALTER TABLE public.admin_audit_log
      ADD CONSTRAINT admin_audit_log_entity_type_check
      CHECK (entity_type IN ('user', 'exercise', 'billing', 'access', 'auth', 'system'));
  END IF;
END $$;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS set_manual_billing_events_updated_at ON public.manual_billing_events;
CREATE TRIGGER set_manual_billing_events_updated_at
  BEFORE UPDATE ON public.manual_billing_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS set_exercise_overrides_updated_at ON public.exercise_overrides;
CREATE TRIGGER set_exercise_overrides_updated_at
  BEFORE UPDATE ON public.exercise_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;

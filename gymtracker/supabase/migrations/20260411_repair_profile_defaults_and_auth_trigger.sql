BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'member',
  ALTER COLUMN access_status SET DEFAULT 'active',
  ALTER COLUMN must_change_password SET DEFAULT FALSE,
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.profiles
SET
  role = CASE
    WHEN lower(btrim(COALESCE(role, ''))) = 'admin' THEN 'admin'
    ELSE 'member'
  END,
  access_status = CASE
    WHEN lower(btrim(COALESCE(access_status, ''))) = 'blocked' THEN 'blocked'
    ELSE 'active'
  END,
  must_change_password = COALESCE(must_change_password, FALSE),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  role IS NULL
  OR lower(btrim(COALESCE(role, ''))) NOT IN ('member', 'admin')
  OR access_status IS NULL
  OR lower(btrim(COALESCE(access_status, ''))) NOT IN ('active', 'blocked')
  OR must_change_password IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  DROP CONSTRAINT IF EXISTS profiles_access_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('member', 'admin')),
  ADD CONSTRAINT profiles_access_status_check
    CHECK (access_status IN ('active', 'blocked'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
      id,
      display_name,
      role,
      access_status,
      paid_until,
      must_change_password,
      created_by_admin_id,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'User'),
      CASE
        WHEN lower(COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'member')) = 'admin' THEN 'admin'
        ELSE 'member'
      END,
      CASE
        WHEN lower(COALESCE(NULLIF(NEW.raw_user_meta_data->>'access_status', ''), 'active')) = 'blocked' THEN 'blocked'
        ELSE 'active'
      END,
      CURRENT_DATE + INTERVAL '365 days',
      FALSE,
      NULL,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      display_name = EXCLUDED.display_name,
      updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;

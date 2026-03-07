-- ============================================================
-- GymTracker — Fix missing profiles and keep auth trigger healthy
-- Run in Supabase SQL Editor on production before go-live
-- ============================================================

-- 1) Backfill profiles for auth users that do not have one yet
INSERT INTO public.profiles (id, display_name)
SELECT
    au.id,
    COALESCE(NULLIF(au.raw_user_meta_data->>'display_name', ''), split_part(au.email, '@', 1), 'User')
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 2) Ensure authenticated users can create their own profile if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND policyname = 'Users can insert own profile'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)';
    END IF;
END
$$;

-- 3) Recreate signup trigger function as idempotent (on conflict do nothing)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'User')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

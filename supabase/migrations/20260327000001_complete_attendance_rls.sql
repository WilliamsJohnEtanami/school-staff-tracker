-- 20260327000001_complete_attendance_rls.sql
-- Migration to set up attendance indexes and RLS policies safely for Supabase

-- 1) Ensure Row Level Security is enabled
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;

-- 2) Create RLS Policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance' AND policyname = 'Users can view own attendance'
  ) THEN
    CREATE POLICY "Users can view own attendance"
    ON public.attendance
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance' AND policyname = 'Users can insert own attendance'
  ) THEN
    CREATE POLICY "Users can insert own attendance"
    ON public.attendance
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance' AND policyname = 'Users can update own attendance'
  ) THEN
    CREATE POLICY "Users can update own attendance"
    ON public.attendance
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance' AND policyname = 'Admins can update attendance'
  ) THEN
    CREATE POLICY "Admins can update attendance"
    ON public.attendance
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- 3) Create indexes safely
CREATE INDEX IF NOT EXISTS idx_attendance_user_id
ON public.attendance(user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_created_at
ON public.attendance(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_status
ON public.attendance(status);

-- Note: Removed partial index with CURRENT_DATE as it's not allowed in PostgreSQL

-- Migration complete

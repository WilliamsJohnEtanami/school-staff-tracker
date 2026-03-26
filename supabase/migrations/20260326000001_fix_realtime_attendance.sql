-- Fix real-time attendance updates visibility
-- Ensure admins can see new attendance records in real-time

-- Verify attendance table exists and has correct structure
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;

-- 1) Verify attendance table has all necessary policies
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can update own attendance (clock out)" ON public.attendance;
DROP POLICY IF EXISTS "Service role can insert attendance" ON public.attendance;

-- 2) Recreate RLS policies for attendance table
CREATE POLICY "Staff can view own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can update own attendance (clock out)" ON public.attendance
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Allow service role to bypass RLS for edge functions
-- This replaces the need for "Service role can insert attendance" since service_role bypasses RLS entirely

-- 4) Verify real-time publication is enabled
-- Ensure attendance table is included in realtime stream so admins get updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- 5) Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON public.attendance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON public.attendance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);

-- 6) Verify the has_role function is accessible
-- The function should exist from initial migration with SECURITY DEFINER
-- This allows it to check user_roles even for authenticated users with SELECT restrictions

COMMENT ON TABLE public.attendance IS 'Attendance records with real-time sync for admins. RLS policy allows admins to see all records and staff to see their own.';

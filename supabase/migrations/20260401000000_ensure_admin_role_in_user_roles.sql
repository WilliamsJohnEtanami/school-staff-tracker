-- Ensure admin role is properly set up for RLS policies to work
-- This migration verifies that the admin user has a role entry in user_roles table

DO $$
BEGIN
  -- Check if admin role exists for the first superuser (typically admin@school.edu)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE role = 'admin'::app_role
    LIMIT 1
  ) THEN
    -- If no admin role exists, create one for setup admin if available
    -- This is a safety measure to ensure at least one admin role exists
    INSERT INTO public.user_roles (user_id, role)
    SELECT DISTINCT auth.users.id, 'admin'::app_role
    FROM auth.users
    WHERE email LIKE '%admin%' OR email = 'admin@school.edu'
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Ensured admin role exists in user_roles table';
  ELSE
    RAISE NOTICE 'Admin role already exists in user_roles table';
  END IF;
END
$$;

-- Ensure attendance table has proper RLS policies for admins to see all records
DO $$
BEGIN
  -- Create policy for admins to SELECT all attendance records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance' 
    AND policyname = 'Admins can view all attendance'
  ) THEN
    CREATE POLICY "Admins can view all attendance"
    ON public.attendance
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'::app_role
      )
    );
    RAISE NOTICE 'Created admin SELECT policy for attendance';
  ELSE
    RAISE NOTICE 'Admin SELECT policy already exists for attendance';
  END IF;
END
$$;

-- Enable realtime publication for attendance table if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
    RAISE NOTICE 'Enabled realtime publication for attendance table';
  ELSE
    RAISE NOTICE 'Realtime publication already enabled for attendance';
  END IF;
END
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Automatically updates the updated_at timestamp column before UPDATE operations';

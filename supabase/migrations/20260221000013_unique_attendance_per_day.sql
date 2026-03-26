-- Recreate attendance table with correct structure if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'staff_id') THEN
        ALTER TABLE public.attendance RENAME TO attendance_wrong_structure;
        CREATE TABLE public.attendance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          staff_name TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'break')),
          device_info TEXT,
          ip_address TEXT,
          device_type TEXT,
          browser TEXT,
          operating_system TEXT,
          location_address TEXT,
          clock_out TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
        ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can update own attendance" ON public.attendance
          FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Recreated attendance table with correct structure';
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_timestamp ON public.attendance (user_id, timestamp);
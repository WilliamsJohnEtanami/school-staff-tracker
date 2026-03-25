-- Recreate attendance table with correct user_id structure
-- This fixes the previous migration that created staff_id structure

-- Backup current table
ALTER TABLE public.attendance RENAME TO attendance_old;

-- Create correct attendance table structure
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

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Recreate the policy that was lost
CREATE POLICY "Users can update own attendance"
  ON public.attendance
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: Data migration from attendance_old would need to be done manually
-- since the structures are incompatible

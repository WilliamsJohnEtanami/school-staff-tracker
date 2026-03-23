-- Add clock_out timestamp to attendance records
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS clock_out TIMESTAMP WITH TIME ZONE;

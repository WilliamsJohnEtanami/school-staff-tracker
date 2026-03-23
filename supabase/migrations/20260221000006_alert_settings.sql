-- Add alert configuration to settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS alert_time TIME DEFAULT '10:00:00',
  ADD COLUMN IF NOT EXISTS alert_email TEXT DEFAULT '';

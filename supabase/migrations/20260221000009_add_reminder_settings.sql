-- Add reminder settings to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS alert_email TEXT,
ADD COLUMN IF NOT EXISTS daily_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS clock_in_reminder BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS clock_out_reminder BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_reports BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_time TEXT DEFAULT '09:00';
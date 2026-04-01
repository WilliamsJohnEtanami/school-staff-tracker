-- Repair missing settings columns and force PostgREST to reload the schema cache.
-- Safe to run multiple times.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS alert_time TIME DEFAULT '10:00:00',
  ADD COLUMN IF NOT EXISTS alert_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS daily_alerts BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS clock_in_reminder BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS clock_out_reminder BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_reports BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_time TEXT DEFAULT '09:00';

ALTER TABLE public.settings
  ALTER COLUMN alert_time SET DEFAULT '10:00:00',
  ALTER COLUMN alert_email SET DEFAULT '',
  ALTER COLUMN daily_alerts SET DEFAULT true,
  ALTER COLUMN clock_in_reminder SET DEFAULT true,
  ALTER COLUMN clock_out_reminder SET DEFAULT true,
  ALTER COLUMN weekly_reports SET DEFAULT true,
  ALTER COLUMN reminder_time SET DEFAULT '09:00';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.settings
  ) THEN
    INSERT INTO public.settings DEFAULT VALUES;
  END IF;
END
$$;

UPDATE public.settings
SET
  alert_time = COALESCE(alert_time, '10:00:00'),
  alert_email = COALESCE(alert_email, ''),
  daily_alerts = COALESCE(daily_alerts, true),
  clock_in_reminder = COALESCE(clock_in_reminder, true),
  clock_out_reminder = COALESCE(clock_out_reminder, true),
  weekly_reports = COALESCE(weekly_reports, true),
  reminder_time = COALESCE(NULLIF(reminder_time, ''), '09:00')
WHERE
  alert_time IS NULL
  OR alert_email IS NULL
  OR daily_alerts IS NULL
  OR clock_in_reminder IS NULL
  OR clock_out_reminder IS NULL
  OR weekly_reports IS NULL
  OR reminder_time IS NULL
  OR reminder_time = '';

COMMENT ON COLUMN public.settings.alert_time IS 'Time to send the daily absence alert email.';
COMMENT ON COLUMN public.settings.alert_email IS 'Destination email address for daily absence alerts.';
COMMENT ON COLUMN public.settings.daily_alerts IS 'Whether daily absence alert emails are enabled.';
COMMENT ON COLUMN public.settings.clock_in_reminder IS 'Whether automated clock-in reminders are enabled.';
COMMENT ON COLUMN public.settings.clock_out_reminder IS 'Whether automated clock-out reminders are enabled.';
COMMENT ON COLUMN public.settings.weekly_reports IS 'Whether weekly attendance reports are enabled.';
COMMENT ON COLUMN public.settings.reminder_time IS 'Time used for automated reminder jobs.';

NOTIFY pgrst, 'reload schema';

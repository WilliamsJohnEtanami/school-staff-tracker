ALTER TABLE public.school_calendar
  DROP CONSTRAINT IF EXISTS school_calendar_event_date_key;

CREATE INDEX IF NOT EXISTS idx_school_calendar_event_date
  ON public.school_calendar (event_date);

NOTIFY pgrst, 'reload schema';

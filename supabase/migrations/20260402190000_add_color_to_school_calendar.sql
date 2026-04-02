ALTER TABLE public.school_calendar
  ADD COLUMN IF NOT EXISTS color TEXT;

UPDATE public.school_calendar
SET color = CASE type
  WHEN 'holiday' THEN '#ef4444'
  WHEN 'early_closure' THEN '#f59e0b'
  WHEN 'no_school' THEN '#22c55e'
  ELSE '#3b82f6'
END
WHERE color IS NULL
   OR btrim(color) = '';

NOTIFY pgrst, 'reload schema';

-- Prevent duplicate attendance per user per day
CREATE UNIQUE INDEX IF NOT EXISTS attendance_user_date_unique
ON public.attendance (user_id, date);
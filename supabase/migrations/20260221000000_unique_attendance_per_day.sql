-- Prevent duplicate attendance records for the same staff member on the same day
CREATE UNIQUE INDEX attendance_user_date_unique
  ON public.attendance (user_id, (timestamp::date));

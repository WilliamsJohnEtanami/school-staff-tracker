# Supabase Admin Instructions
# School Staff Tracker — Database & Function Setup
# Run each SQL block one at a time in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

---

## STEP 1 — Unique attendance per day
# Prevents a staff member from submitting more than one attendance record per day at the database level.

CREATE UNIQUE INDEX attendance_user_date_unique
  ON public.attendance (user_id, (timestamp::date));


---

## STEP 2 — Clock out column
# Adds a clock_out timestamp column to the attendance table.

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS clock_out TIMESTAMP WITH TIME ZONE;


---

## STEP 3 — RLS policy for clock out
# Allows staff to update their own attendance record (needed for clock-out).

CREATE POLICY "Users can update own attendance"
  ON public.attendance
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


---

## STEP 4 — Leave requests table
# Creates the leave_requests table with all required RLS policies.

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  staff_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own leave requests" ON public.leave_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Staff can insert own leave requests" ON public.leave_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all leave requests" ON public.leave_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leave requests" ON public.leave_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


---

## STEP 5 — Rate limiting
# Prevents more than 3 clock-in attempts per user within 60 seconds.

CREATE TABLE public.clock_in_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clock_in_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_clock_in_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.clock_in_attempts
  WHERE user_id = NEW.user_id
    AND attempted_at > now() - INTERVAL '60 seconds';

  INSERT INTO public.clock_in_attempts (user_id) VALUES (NEW.user_id);

  DELETE FROM public.clock_in_attempts
  WHERE attempted_at < now() - INTERVAL '10 minutes';

  IF attempt_count >= 3 THEN
    RAISE EXCEPTION 'Too many clock-in attempts. Please wait a moment before trying again.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_clock_in_rate_limit
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.check_clock_in_rate_limit();


---

## STEP 6 — Alert settings
# Adds alert_time and alert_email columns to the settings table.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS alert_time TIME DEFAULT '10:00:00',
  ADD COLUMN IF NOT EXISTS alert_email TEXT DEFAULT '';


---

## STEP 7 — Remove direct attendance insert policy
# IMPORTANT: Only run this AFTER the clock-in edge function has been deployed (see below).
# This removes the ability for staff to insert attendance records directly,
# forcing all clock-ins to go through the server-side edge function.

DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;


---

## EDGE FUNCTION DEPLOYMENT
# Run these commands in your terminal from the project root directory.
# Make sure you have the Supabase CLI installed: npm install -g supabase

# Deploy the clock-in function (handles GPS validation server-side):
# Keep gateway JWT verification disabled because the function validates the bearer token internally.
npx supabase functions deploy clock-in --no-verify-jwt

# Deploy the daily alert function (sends absent staff email daily):
npx supabase functions deploy daily-alert

# Deploy the manage-staff function (if not already deployed):
# Keep gateway JWT verification disabled because the function validates the bearer token internally.
npx supabase functions deploy manage-staff --no-verify-jwt


---

## RESEND EMAIL SETUP (for daily alerts)
# The daily alert email is sent via Resend (free tier is sufficient).
# 1. Sign up at https://resend.com
# 2. Get your API key from the Resend dashboard
# 3. Add it as a Supabase secret:
npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here

# 4. In supabase/functions/daily-alert/index.ts, update the "from" field
#    to use your verified Resend domain:
#    from: "Staff Attendance <alerts@yourdomain.com>"

# 5. In the app Settings page, enter the admin email address to receive alerts
#    and set the daily alert time.


---

## CRON SCHEDULE
# The daily alert runs automatically Monday–Friday at 10:00 AM UTC.
# To change the time, edit supabase/config.toml and redeploy.
# Current schedule: "0 10 * * 1-5" (10am UTC, Mon-Fri)
# Use https://crontab.guru to build a custom schedule if needed.

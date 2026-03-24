-- Phase 1: New Tables

-- Work Sessions: Replaces the old attendance model.
-- Each row is a single continuous period of work, break, or off-site duty.
CREATE TABLE public.work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('work', 'break', 'off-site')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_work_sessions_user_date ON public.work_sessions(user_id, session_date);

-- Staff Contracts: Defines expected hours and grace period for each staff member.
CREATE TABLE public.staff_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    contracted_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.00,
    grace_minutes INTEGER NOT NULL DEFAULT 15,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_contracts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_staff_contracts_updated_at
  BEFORE UPDATE ON public.staff_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- School Calendar: Marks holidays, early closures, etc.
CREATE TABLE public.school_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date DATE NOT NULL UNIQUE,
    event_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('holiday', 'early_closure', 'no_school', 'event')),
    expected_hours NUMERIC(4, 2), -- Nullable, overrides contract on early closure days
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.school_calendar ENABLE ROW LEVEL SECURITY;

-- Location Pings: Stores periodic GPS checks from the service worker.
CREATE TABLE public.location_pings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES public.work_sessions(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_from_school_meters INTEGER,
    is_outside_radius BOOLEAN,
    location_available BOOLEAN NOT NULL DEFAULT true,
    pinged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_location_pings_user_timestamp ON public.location_pings(user_id, pinged_at);


-- Phase 2: RLS Policies

-- Work Sessions
CREATE POLICY "Staff can read their own work sessions" ON public.work_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert their own work sessions" ON public.work_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can update their own un-ended work sessions" ON public.work_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND ended_at IS NULL);
CREATE POLICY "Admins can manage all work sessions" ON public.work_sessions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff Contracts
CREATE POLICY "Staff can read their own contract" ON public.staff_contracts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all contracts" ON public.staff_contracts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- School Calendar
CREATE POLICY "All authenticated users can read the calendar" ON public.school_calendar
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage the calendar" ON public.school_calendar
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Location Pings
CREATE POLICY "Staff can insert their own location pings" ON public.location_pings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all location pings" ON public.location_pings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- Phase 3: Data Migration
-- Move data from the old 'attendance' table to the new 'work_sessions' table.

-- First, rename the old table to avoid conflicts and for archival purposes.
ALTER TABLE public.attendance RENAME TO attendance_archive;

-- Create a function to perform the migration.
CREATE OR REPLACE FUNCTION public.migrate_attendance_to_sessions()
RETURNS void AS $$
DECLARE
    record RECORD;
BEGIN
    -- Loop through each old attendance record
    FOR record IN SELECT * FROM public.attendance_archive ORDER BY timestamp ASC LOOP
        -- Create the primary 'work' session for the clock-in time.
        INSERT INTO public.work_sessions (user_id, session_date, type, started_at, ended_at)
        VALUES (
            record.user_id,
            record.timestamp::date,
            'work',
            record.timestamp, -- started_at is the old clock-in time
            record.clock_out  -- ended_at is the old clock-out time (can be null)
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function.
SELECT public.migrate_attendance_to_sessions();

-- Drop the function as it's no longer needed.
DROP FUNCTION public.migrate_attendance_to_sessions();


-- Phase 4: Clean up old triggers and constraints that are now obsolete
-- These may or may not exist depending on what was run previously, so we use IF EXISTS.

DROP TRIGGER IF EXISTS enforce_clock_in_rate_limit ON public.attendance_archive;
DROP FUNCTION IF EXISTS public.check_clock_in_rate_limit();
DROP TABLE IF EXISTS public.clock_in_attempts;
DROP INDEX IF EXISTS public.attendance_user_date_unique;

-- Add a new rate limiting function for the 'work_sessions' table
CREATE TABLE public.session_start_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_start_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_session_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  -- Only rate limit the initial 'work' session for the day (clock-in)
  IF NEW.type = 'work' AND (SELECT COUNT(*) FROM public.work_sessions WHERE user_id = NEW.user_id AND session_date = NEW.session_date) = 0 THEN
    SELECT COUNT(*) INTO attempt_count
    FROM public.session_start_attempts
    WHERE user_id = NEW.user_id
      AND attempted_at > now() - INTERVAL '60 seconds';

    INSERT INTO public.session_start_attempts (user_id) VALUES (NEW.user_id);

    IF attempt_count >= 5 THEN
      RAISE EXCEPTION 'Too many clock-in attempts. Please wait a moment before trying again.';
    END IF;
  END IF;

  -- Clean up old attempts regardless
  DELETE FROM public.session_start_attempts
  WHERE attempted_at < now() - INTERVAL '10 minutes';

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_session_rate_limit
  BEFORE INSERT ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_session_rate_limit();

-- Add a unique constraint to prevent duplicate sessions of the same type starting at the exact same time
CREATE UNIQUE INDEX work_sessions_user_type_start_unique ON public.work_sessions(user_id, type, started_at);

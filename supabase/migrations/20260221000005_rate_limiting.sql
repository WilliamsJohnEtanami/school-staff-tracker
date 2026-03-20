-- Rate limit clock-in attempts: max 3 attempts per user per 60 seconds
-- We track attempts in a separate table
CREATE TABLE public.clock_in_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clock_in_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read (edge function uses service role)
-- No RLS policies needed for authenticated users since only the edge function touches this table

-- Function to check rate limit before allowing clock-in
CREATE OR REPLACE FUNCTION public.check_clock_in_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  -- Count attempts in the last 60 seconds for this user
  SELECT COUNT(*) INTO attempt_count
  FROM public.clock_in_attempts
  WHERE user_id = NEW.user_id
    AND attempted_at > now() - INTERVAL '60 seconds';

  -- Log this attempt
  INSERT INTO public.clock_in_attempts (user_id) VALUES (NEW.user_id);

  -- Clean up old attempts older than 10 minutes to keep the table small
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

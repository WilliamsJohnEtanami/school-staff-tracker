-- Staff no longer insert attendance directly; the clock-in edge function handles it via service role.
-- Remove the direct insert policy to prevent bypassing server-side GPS validation.
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;

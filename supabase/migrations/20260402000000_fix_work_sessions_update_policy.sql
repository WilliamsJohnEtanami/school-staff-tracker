-- Allow staff to close their own active work session without failing RLS on the updated row.
DROP POLICY IF EXISTS "Staff can update their own un-ended work sessions" ON public.work_sessions;

CREATE POLICY "Staff can update their own un-ended work sessions" ON public.work_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND ended_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

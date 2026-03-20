-- Allow staff to update their own attendance (for clock-out)
CREATE POLICY "Users can update own attendance"
  ON public.attendance
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

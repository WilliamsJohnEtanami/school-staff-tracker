ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS shift_name TEXT;

UPDATE public.profiles
SET department = NULL
WHERE department IS NOT NULL
  AND btrim(department) = '';

UPDATE public.profiles
SET shift_name = NULL
WHERE shift_name IS NOT NULL
  AND btrim(shift_name) = '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS audience_type TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS audience_summary TEXT,
  ADD COLUMN IF NOT EXISTS recipient_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

INSERT INTO public.notification_recipients (notification_id, user_id)
SELECT notifications.id, user_roles.user_id
FROM public.notifications
JOIN public.user_roles
  ON user_roles.role = 'staff'
ON CONFLICT (notification_id, user_id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can select notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view targeted notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Admins can view all notifications"
  ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view targeted notifications"
  ON public.notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.notification_recipients
      WHERE notification_recipients.notification_id = notifications.id
        AND notification_recipients.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage notification statuses" ON public.notification_statuses;

CREATE POLICY "Service role can manage notification statuses"
  ON public.notification_statuses
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own notification recipients" ON public.notification_recipients;
DROP POLICY IF EXISTS "Admins can view all notification recipients" ON public.notification_recipients;
DROP POLICY IF EXISTS "Service role can manage notification recipients" ON public.notification_recipients;

CREATE POLICY "Users can view own notification recipients"
  ON public.notification_recipients
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification recipients"
  ON public.notification_recipients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage notification recipients"
  ON public.notification_recipients
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_profiles_department
  ON public.profiles (department);

CREATE INDEX IF NOT EXISTS idx_profiles_shift_name
  ON public.profiles (shift_name);

CREATE INDEX IF NOT EXISTS idx_notifications_audience_type
  ON public.notifications (audience_type);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_id
  ON public.notification_recipients (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id
  ON public.notification_recipients (notification_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_recipients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_recipients;
  END IF;
END
$$;

COMMENT ON TABLE public.notification_recipients IS 'Explicit per-user delivery list for targeted notifications.';

NOTIFY pgrst, 'reload schema';

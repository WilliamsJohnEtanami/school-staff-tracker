-- Repair notifications schema visibility and publish staff activity tables to realtime.
-- Safe to run multiple times.

-- 1) Ensure notifications tables exist
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_statuses ENABLE ROW LEVEL SECURITY;

-- 2) Ensure notification policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Authenticated can view all notifications'
  ) THEN
    CREATE POLICY "Authenticated can view all notifications"
      ON public.notifications
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Admins can insert notifications'
  ) THEN
    CREATE POLICY "Admins can insert notifications"
      ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Admins can delete notifications'
  ) THEN
    CREATE POLICY "Admins can delete notifications"
      ON public.notifications
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_statuses'
      AND policyname = 'Users can view own notification status'
  ) THEN
    CREATE POLICY "Users can view own notification status"
      ON public.notification_statuses
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_statuses'
      AND policyname = 'Users can insert own notification status'
  ) THEN
    CREATE POLICY "Users can insert own notification status"
      ON public.notification_statuses
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_statuses'
      AND policyname = 'Users can update own notification status'
  ) THEN
    CREATE POLICY "Users can update own notification status"
      ON public.notification_statuses
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- 3) Ensure indexes and trigger exist
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_statuses_user_id
  ON public.notification_statuses(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_statuses_notification_id
  ON public.notification_statuses(notification_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_statuses_updated_at ON public.notification_statuses;
CREATE TRIGGER update_notification_statuses_updated_at
  BEFORE UPDATE ON public.notification_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Publish staff activity tables to realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_statuses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_statuses;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'work_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leave_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
  END IF;
END
$$;

COMMENT ON TABLE public.notifications IS 'Broadcast notifications for staff and admins.';
COMMENT ON TABLE public.notification_statuses IS 'Per-user read state for broadcast notifications.';

-- 5) Ask PostgREST to reload its schema cache so new tables become visible immediately
NOTIFY pgrst, 'reload schema';

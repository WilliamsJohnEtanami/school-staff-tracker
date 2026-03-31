-- Ensure notifications system works properly with realtime
-- This migration DOES NOT DROP tables - it adds missing pieces only

-- 1) Ensure notifications table exists with correct columns
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    CREATE TABLE public.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- 2) Ensure notification_statuses table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notification_statuses'
  ) THEN
    CREATE TABLE public.notification_statuses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(notification_id, user_id)
    );
  END IF;
END $$;

-- 3) Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_statuses ENABLE ROW LEVEL SECURITY;

-- 4) Drop old policies to recreate them (non-destructive)
DROP POLICY IF EXISTS "Authenticated can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can select notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;

-- 5) Recreate RLS policies for notifications table
CREATE POLICY "Authenticated can view all notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6) Recreate policies for notification_statuses
DROP POLICY IF EXISTS "Users can view own notification status" ON public.notification_statuses;
DROP POLICY IF EXISTS "Users can insert own notification status" ON public.notification_statuses;
DROP POLICY IF EXISTS "Users can update own notification status" ON public.notification_statuses;
DROP POLICY IF EXISTS "Admins can manage all notification statuses" ON public.notification_statuses;

CREATE POLICY "Users can view own notification status" ON public.notification_statuses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification status" ON public.notification_statuses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification status" ON public.notification_statuses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage notification statuses" ON public.notification_statuses
  FOR ALL
  WITH CHECK (true);

-- 7) Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_notification_statuses_user_id ON public.notification_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_statuses_notification_id ON public.notification_statuses(notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 8) Ensure trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9) Create/recreate trigger
DROP TRIGGER IF EXISTS update_notification_statuses_updated_at ON public.notification_statuses;
CREATE TRIGGER update_notification_statuses_updated_at
  BEFORE UPDATE ON public.notification_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10) Ensure realtime publication is enabled
-- These are idempotent - they check the system catalog before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notification_statuses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_statuses;
  END IF;
END
$$;

COMMENT ON TABLE public.notifications IS 'System broadcasts from admins to all users. Real-time enabled.';
COMMENT ON TABLE public.notification_statuses IS 'Per-user read status for notifications. Real-time enabled.';

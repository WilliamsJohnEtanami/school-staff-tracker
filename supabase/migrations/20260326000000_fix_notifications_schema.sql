-- Fix notification system with proper schema and policies
-- This ensures notification_statuses table exists with correct structure and RLS

-- Drop and recreate notifications table if it exists with wrong structure
DROP TABLE IF EXISTS public.notification_statuses CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Create notifications table (broadcasts from admins to all users)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notification_statuses table (tracks read/unread state per user)
CREATE TABLE public.notification_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_statuses ENABLE ROW LEVEL SECURITY;

-- Policies for notifications table
CREATE POLICY "Authenticated can view all notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Policies for notification_statuses table
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

CREATE POLICY "Admins can manage all notification statuses" ON public.notification_statuses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_notification_statuses_user_id ON public.notification_statuses(user_id);
CREATE INDEX idx_notification_statuses_notification_id ON public.notification_statuses(notification_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at
DROP TRIGGER IF EXISTS update_notification_statuses_updated_at ON public.notification_statuses;
CREATE TRIGGER update_notification_statuses_updated_at
  BEFORE UPDATE ON public.notification_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_statuses;

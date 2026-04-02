-- Staff feedback threads and direct admin replies.
-- Safe to apply after the core attendance schema.

CREATE TABLE IF NOT EXISTS public.feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  staff_email TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.feedback_threads(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('staff', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feedback_threads_staff_user_id
  ON public.feedback_threads(staff_user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_threads_last_message_at
  ON public.feedback_threads(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread_id_created_at
  ON public.feedback_messages(thread_id, created_at);

DROP POLICY IF EXISTS "Admins can manage all feedback threads" ON public.feedback_threads;
DROP POLICY IF EXISTS "Staff can insert their own feedback threads" ON public.feedback_threads;
DROP POLICY IF EXISTS "Staff can view their own feedback threads" ON public.feedback_threads;
DROP POLICY IF EXISTS "Staff can update their own feedback threads" ON public.feedback_threads;

CREATE POLICY "Staff can view their own feedback threads"
  ON public.feedback_threads
  FOR SELECT TO authenticated
  USING (
    auth.uid() = staff_user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Staff can insert their own feedback threads"
  ON public.feedback_threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = staff_user_id);

CREATE POLICY "Staff can update their own feedback threads"
  ON public.feedback_threads
  FOR UPDATE TO authenticated
  USING (auth.uid() = staff_user_id)
  WITH CHECK (auth.uid() = staff_user_id);

CREATE POLICY "Admins can manage all feedback threads"
  ON public.feedback_threads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all feedback messages" ON public.feedback_messages;
DROP POLICY IF EXISTS "Staff can view their feedback messages" ON public.feedback_messages;
DROP POLICY IF EXISTS "Staff can insert their own feedback messages" ON public.feedback_messages;

CREATE POLICY "Staff can view their feedback messages"
  ON public.feedback_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.feedback_threads
      WHERE public.feedback_threads.id = feedback_messages.thread_id
        AND public.feedback_threads.staff_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert their own feedback messages"
  ON public.feedback_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (
      (
        sender_role = 'staff'
        AND EXISTS (
          SELECT 1
          FROM public.feedback_threads
          WHERE public.feedback_threads.id = feedback_messages.thread_id
            AND public.feedback_threads.staff_user_id = auth.uid()
        )
      )
      OR (
        sender_role = 'admin'
        AND public.has_role(auth.uid(), 'admin')
      )
    )
  );

CREATE POLICY "Admins can view all feedback messages"
  ON public.feedback_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_feedback_threads_updated_at ON public.feedback_threads;
CREATE TRIGGER update_feedback_threads_updated_at
  BEFORE UPDATE ON public.feedback_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feedback_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feedback_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_messages;
  END IF;
END
$$;

COMMENT ON TABLE public.feedback_threads IS 'Feedback threads opened by staff and handled by admins.';
COMMENT ON TABLE public.feedback_messages IS 'Messages exchanged inside feedback threads.';

NOTIFY pgrst, 'reload schema';

-- Normalize feedback into one ongoing conversation per staff member.
-- This keeps the UI aligned with a phone-style messaging experience.

ALTER TABLE public.feedback_threads
  ALTER COLUMN subject SET DEFAULT 'Feedback conversation';

UPDATE public.feedback_threads
SET subject = 'Feedback conversation'
WHERE btrim(coalesce(subject, '')) = '';

WITH ranked_threads AS (
  SELECT
    id,
    staff_user_id,
    first_value(id) OVER (
      PARTITION BY staff_user_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY staff_user_id
      ORDER BY created_at ASC, id ASC
    ) AS thread_rank
  FROM public.feedback_threads
),
duplicate_threads AS (
  SELECT id, canonical_id
  FROM ranked_threads
  WHERE thread_rank > 1
)
UPDATE public.feedback_messages AS messages
SET thread_id = duplicate_threads.canonical_id
FROM duplicate_threads
WHERE messages.thread_id = duplicate_threads.id;

WITH ranked_threads AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY staff_user_id
      ORDER BY created_at ASC, id ASC
    ) AS thread_rank
  FROM public.feedback_threads
)
DELETE FROM public.feedback_threads AS threads
USING ranked_threads
WHERE threads.id = ranked_threads.id
  AND ranked_threads.thread_rank > 1;

UPDATE public.feedback_threads AS threads
SET
  last_message_at = coalesce(message_rollup.latest_created_at, threads.last_message_at),
  updated_at = now()
FROM (
  SELECT thread_id, max(created_at) AS latest_created_at
  FROM public.feedback_messages
  GROUP BY thread_id
) AS message_rollup
WHERE threads.id = message_rollup.thread_id;

CREATE UNIQUE INDEX IF NOT EXISTS feedback_threads_staff_user_id_unique
  ON public.feedback_threads(staff_user_id);

NOTIFY pgrst, 'reload schema';

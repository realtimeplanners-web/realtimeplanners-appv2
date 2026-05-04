-- Rollback: point progress_updates.created_by back to profiles(id)
-- Use only if your intended model is profiles-backed actors.

BEGIN;

ALTER TABLE IF EXISTS public.progress_updates
  DROP CONSTRAINT IF EXISTS progress_updates_created_by_fkey;

ALTER TABLE IF EXISTS public.progress_updates
  ADD CONSTRAINT progress_updates_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

COMMIT;


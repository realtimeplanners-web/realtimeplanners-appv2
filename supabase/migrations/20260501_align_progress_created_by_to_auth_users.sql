-- Align progress_updates.created_by to canonical auth identity
-- This keeps RBAC roles separate while making audit actor ids consistent.

BEGIN;

-- Drop current FK if it exists (commonly points to profiles)
ALTER TABLE IF EXISTS public.progress_updates
  DROP CONSTRAINT IF EXISTS progress_updates_created_by_fkey;

-- Ensure column type is UUID
ALTER TABLE IF EXISTS public.progress_updates
  ALTER COLUMN created_by TYPE uuid USING created_by::uuid;

-- Recreate FK to auth.users(id)
ALTER TABLE IF EXISTS public.progress_updates
  ADD CONSTRAINT progress_updates_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

COMMIT;


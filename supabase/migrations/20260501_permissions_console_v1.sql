-- Permissions Console v1
-- Non-destructive creation of role/feature/permission tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  module text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.app_features(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'none' CHECK (scope IN ('none', 'own', 'org', 'all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_feature_id ON public.role_permissions(feature_id);

-- Seed default roles
INSERT INTO public.roles (code, label, is_system)
VALUES
  ('super_admin', 'Super Admin', true),
  ('org_admin', 'Org Admin', true),
  ('user', 'User', true),
  ('qc', 'QC', true),
  ('maker', 'Maker', true),
  ('checker', 'Checker', true)
ON CONFLICT (code) DO NOTHING;

-- Seed starter feature set
INSERT INTO public.app_features (code, label, module, description)
VALUES
  ('activities.create', 'Create Activity', 'activities', 'Create new activities'),
  ('activities.update_progress', 'Update Progress', 'activities', 'Post activity progress updates'),
  ('activities.edit', 'Edit Activity', 'activities', 'Edit existing activities'),
  ('activities.delete', 'Delete Activity', 'activities', 'Delete activities'),
  ('users.manage', 'Manage Users', 'users', 'Create/update/delete users'),
  ('permissions.manage', 'Manage Permissions', 'permissions', 'Open and edit role permissions')
ON CONFLICT (code) DO NOTHING;

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Basic read for authenticated users
DROP POLICY IF EXISTS roles_read_authenticated ON public.roles;
CREATE POLICY roles_read_authenticated ON public.roles
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS app_features_read_authenticated ON public.app_features;
CREATE POLICY app_features_read_authenticated ON public.app_features
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS role_permissions_read_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_read_authenticated ON public.role_permissions
FOR SELECT USING (auth.role() = 'authenticated');

-- Manage role permissions from authenticated sessions (tighten later if needed)
DROP POLICY IF EXISTS role_permissions_write_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_write_authenticated ON public.role_permissions
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS roles_write_authenticated ON public.roles;
CREATE POLICY roles_write_authenticated ON public.roles
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS app_features_write_authenticated ON public.app_features;
CREATE POLICY app_features_write_authenticated ON public.app_features
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

COMMIT;


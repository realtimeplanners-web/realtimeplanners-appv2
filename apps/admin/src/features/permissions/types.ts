export interface Role {
  id: string;
  code: string;
  label: string;
  is_system: boolean;
}

export interface Feature {
  id: string;
  code: string;
  label: string;
  module: string;
  description: string | null;
}

export interface RolePermission {
  id: string;
  role_id: string;
  feature_id: string;
  allowed: boolean;
  scope: "none" | "own" | "org" | "all";
}

export interface PermissionCell {
  roleId: string;
  featureId: string;
  allowed: boolean;
  scope: "none" | "own" | "org" | "all";
  recordId?: string;
}


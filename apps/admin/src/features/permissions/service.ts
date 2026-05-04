import { supabase } from "../../app/lib/supabase";
import type { Feature, Role, RolePermission } from "./types";

export const permissionsService = {
  async fetchRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from("roles")
      .select("id, code, label, is_system")
      .order("label", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Role[];
  },

  async fetchFeatures(): Promise<Feature[]> {
    const { data, error } = await supabase
      .from("app_features")
      .select("id, code, label, module, description")
      .order("module", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Feature[];
  },

  async fetchRolePermissions(): Promise<RolePermission[]> {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("id, role_id, feature_id, allowed, scope");
    if (error) throw error;
    return (data ?? []) as RolePermission[];
  },

  async upsertRolePermission(input: {
    role_id: string;
    feature_id: string;
    allowed: boolean;
    scope: "none" | "own" | "org" | "all";
  }): Promise<void> {
    const { error } = await supabase
      .from("role_permissions")
      .upsert(input, { onConflict: "role_id,feature_id" });
    if (error) throw error;
  },
};


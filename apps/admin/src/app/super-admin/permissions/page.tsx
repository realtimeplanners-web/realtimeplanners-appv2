"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import PermissionsConsole from "../../../features/permissions/components/PermissionsConsole";
import { permissionsService } from "../../../features/permissions/service";
import type { Feature, PermissionCell, Role, RolePermission } from "../../../features/permissions/types";
import { canManagePermissions } from "../../../shared/permissions/roleCapabilities";

function toMatrix(items: RolePermission[]): Record<string, PermissionCell> {
  const out: Record<string, PermissionCell> = {};
  for (const item of items) {
    out[`${item.role_id}:${item.feature_id}`] = {
      roleId: item.role_id,
      featureId: item.feature_id,
      allowed: item.allowed,
      scope: item.scope,
      recordId: item.id,
    };
  }
  return out;
}

export default function SuperAdminPermissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [matrix, setMatrix] = useState<Record<string, PermissionCell>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const setupSql = useMemo(
    () =>
      "Open and run: C:/Users/USER/Desktop/realtimeplanners/supabase/migrations/20260501_permissions_console_v1.sql",
    []
  );

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/");
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("email", user.email)
          .single();

        if (!canManagePermissions(userData?.role)) {
          router.push("/unauthorized");
          return;
        }

        const [rolesData, featuresData, permissionsData] = await Promise.all([
          permissionsService.fetchRoles(),
          permissionsService.fetchFeatures(),
          permissionsService.fetchRolePermissions(),
        ]);

        setRoles(rolesData);
        setFeatures(featuresData);
        setMatrix(toMatrix(permissionsData));
      } catch (e: any) {
        const message = String(e?.message || "");
        if (message.includes("relation") || message.includes("does not exist")) {
          setError(`Permissions tables are missing. ${setupSql}`);
        } else {
          setError(message || "Failed to load permissions console.");
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router, setupSql]);

  const upsertCell = async (
    roleId: string,
    featureId: string,
    patch: Partial<Pick<PermissionCell, "allowed" | "scope">>
  ) => {
    const key = `${roleId}:${featureId}`;
    const current = matrix[key] ?? {
      roleId,
      featureId,
      allowed: false,
      scope: "none" as const,
    };
    const next: PermissionCell = { ...current, ...patch };

    setSavingKey(key);
    setError(null);
    setMatrix((prev) => ({ ...prev, [key]: next }));
    try {
      await permissionsService.upsertRolePermission({
        role_id: roleId,
        feature_id: featureId,
        allowed: next.allowed,
        scope: next.allowed ? next.scope : "none",
      });
    } catch (e: any) {
      setError(e?.message || "Failed to update permission.");
      setMatrix((prev) => ({ ...prev, [key]: current }));
    } finally {
      setSavingKey(null);
    }
  };

  const getRecommendedPermission = (roleCode: string, featureCode: string) => {
    if (roleCode === "super_admin") return { allowed: true, scope: "all" as const };

    if (roleCode === "org_admin") {
      if (featureCode === "permissions.manage") return { allowed: false, scope: "none" as const };
      return { allowed: true, scope: "org" as const };
    }

    if (roleCode === "user") {
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "own" as const };
      return { allowed: false, scope: "none" as const };
    }

    if (roleCode === "qc") {
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "org" as const };
      return { allowed: false, scope: "none" as const };
    }

    if (roleCode === "maker") {
      if (featureCode === "activities.create") return { allowed: true, scope: "org" as const };
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "own" as const };
      return { allowed: false, scope: "none" as const };
    }

    if (roleCode === "checker") {
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "org" as const };
      return { allowed: false, scope: "none" as const };
    }

    return { allowed: false, scope: "none" as const };
  };

  const applyRecommendedDefaults = async () => {
    if (roles.length === 0 || features.length === 0) return;
    setApplyingDefaults(true);
    setError(null);
    setStatus(null);
    try {
      const nextMatrix: Record<string, PermissionCell> = { ...matrix };

      for (const role of roles) {
        for (const feature of features) {
          const recommended = getRecommendedPermission(role.code, feature.code);
          await permissionsService.upsertRolePermission({
            role_id: role.id,
            feature_id: feature.id,
            allowed: recommended.allowed,
            scope: recommended.scope,
          });

          const key = `${role.id}:${feature.id}`;
          nextMatrix[key] = {
            roleId: role.id,
            featureId: feature.id,
            allowed: recommended.allowed,
            scope: recommended.scope,
          };
        }
      }

      setMatrix(nextMatrix);
      setStatus("Recommended defaults applied successfully.");
    } catch (e: any) {
      setError(e?.message || "Failed to apply defaults.");
    } finally {
      setApplyingDefaults(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
        <p className="text-gray-700 dark:text-gray-200">Loading permissions console...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Role Permissions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Control feature access using toggles and scope dropdowns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={applyRecommendedDefaults}
              disabled={applyingDefaults}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applyingDefaults ? "Applying..." : "Apply Recommended Defaults"}
            </button>
            <button
              onClick={() => router.push("/super-admin")}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Back
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {status && (
          <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-500/40 dark:bg-green-950/30 dark:text-green-300">
            {status}
          </div>
        )}

        {!error && (
          <PermissionsConsole
            roles={roles}
            features={features}
            matrix={matrix}
            savingKey={savingKey}
            onToggle={(roleId, featureId, nextAllowed) =>
              upsertCell(roleId, featureId, { allowed: nextAllowed })
            }
            onScopeChange={(roleId, featureId, nextScope) =>
              upsertCell(roleId, featureId, { scope: nextScope })
            }
          />
        )}
      </div>
    </div>
  );
}

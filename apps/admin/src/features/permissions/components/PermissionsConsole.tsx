"use client";

import { useMemo, useState } from "react";
import type { Feature, PermissionCell, Role } from "../types";

interface Props {
  roles: Role[];
  features: Feature[];
  matrix: Record<string, PermissionCell>;
  savingKey: string | null;
  onToggle: (roleId: string, featureId: string, nextAllowed: boolean) => Promise<void>;
  onScopeChange: (
    roleId: string,
    featureId: string,
    nextScope: "none" | "own" | "org" | "all"
  ) => Promise<void>;
}

const scopes: Array<"none" | "own" | "org" | "all"> = ["none", "own", "org", "all"];

export default function PermissionsConsole({
  roles,
  features,
  matrix,
  savingKey,
  onToggle,
  onScopeChange,
}: Props) {
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const modules = useMemo(() => {
    const unique = new Set(features.map((f) => f.module));
    return ["all", ...Array.from(unique)];
  }, [features]);

  const filteredFeatures = useMemo(() => {
    if (moduleFilter === "all") return features;
    return features.filter((f) => f.module === moduleFilter);
  }, [features, moduleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Permissions Console</h2>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {modules.map((module) => (
            <option key={module} value={module}>
              {module === "all" ? "All modules" : module}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Feature</th>
              {roles.map((role) => (
                <th key={role.id} className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200">
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredFeatures.map((feature) => (
              <tr key={feature.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-gray-900 dark:text-white">{feature.label}</div>
                  <div className="text-xs text-gray-500">{feature.code}</div>
                </td>
                {roles.map((role) => {
                  const key = `${role.id}:${feature.id}`;
                  const cell = matrix[key] ?? {
                    roleId: role.id,
                    featureId: feature.id,
                    allowed: false,
                    scope: "none" as const,
                  };
                  const busy = savingKey === key;

                  return (
                    <td key={key} className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cell.allowed}
                            disabled={busy}
                            onChange={(e) => onToggle(role.id, feature.id, e.target.checked)}
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-200">Allowed</span>
                        </label>
                        <select
                          value={cell.scope}
                          disabled={!cell.allowed || busy}
                          onChange={(e) =>
                            onScopeChange(
                              role.id,
                              feature.id,
                              e.target.value as "none" | "own" | "org" | "all"
                            )
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        >
                          {scopes.map((scope) => (
                            <option key={scope} value={scope}>
                              {scope}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


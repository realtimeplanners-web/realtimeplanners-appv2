export type AppRole =
  | "super_admin"
  | "org_admin"
  | "user"
  | "qc"
  | "maker"
  | "checker";

export const canCreateActivity = (role: string | null | undefined): boolean => {
  return role === "super_admin" || role === "org_admin";
};

export const canManagePermissions = (role: string | null | undefined): boolean => {
  return role === "super_admin";
};


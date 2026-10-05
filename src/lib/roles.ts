/** Role model for the COHT CBT portal. Authorization is enforced server-side. */
export type Role = "student" | "admin" | "superadmin";

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  admin: "Admin",
  superadmin: "SuperAdmin",
};

export const ROLE_HOME: Record<Role, string> = {
  student: "/",
  admin: "/admin",
  superadmin: "/superadmin",
};

/**
 * Capability matrix, mirrored by Supabase RLS. The UI uses it only to hide
 * affordances; it is never the security boundary.
 */
export const ROLE_CAPABILITIES = {
  student: ["sit-exam", "view-own-profile"],
  admin: [
    "monitor-assigned-papers",
    "clear-student-into-paper",
    "flag-supervisor",
    "pause-resume-assigned",
  ],
  superadmin: [
    "monitor-all-papers",
    "manage-students",
    "manage-papers",
    "view-results",
    "export-results",
    "view-security-logs",
    "manage-admins",
    "system-settings",
    "override-student-identity",
  ],
} as const;

export function can(role: Role, capability: string): boolean {
  return (ROLE_CAPABILITIES[role] as readonly string[]).includes(capability);
}
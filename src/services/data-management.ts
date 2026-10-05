import { supabase } from "@/lib/supabase";

export type ImportEntity = "students" | "courses" | "registrations" | "questions";
export interface ImportIssue { row: number; field?: string; severity: "error" | "warning"; message: string; }
export interface ImportValidationResult { entity: ImportEntity; totalRows: number; validRows: number; warningRows: number; errorRows: number; duplicateRows: number; issues: ImportIssue[]; normalizedRows: Record<string, unknown>[]; }

async function requireSuperAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error("Authentication required.");
  const { data, error } = await supabase.from("profiles").select("role,is_active").eq("id", userData.user.id).single();
  if (error) throw new Error(error.message);
  if (data.role !== "superadmin" || !data.is_active) throw new Error("SuperAdmin authorization required.");
}

export const dataManagementService = {
  async validateImport(input: { entity: ImportEntity; rows: Record<string, unknown>[] }) {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_validate_import", { p_entity: input.entity, p_rows: input.rows });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The server returned no validation result.");
    return data as ImportValidationResult;
  },
  async resetApplicationData() {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_reset_application_data");
    if (error) throw new Error(error.message);
    return data as { status: string; staff_profiles_preserved: number; student_auth_accounts_removed: number };
  },
  async clearStudents() {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_clear_students");
    if (error) throw new Error(error.message);
    return data as { status: string; students_deleted: number; student_auth_accounts_removed: number; registrations_deleted: number; results_deleted: number; result_mail_requests_deleted: number; student_otps_deleted: number; attendance_deleted: number };
  },
  async clearCourses() {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_clear_courses");
    if (error) throw new Error(error.message);
    return data as { status: string; deleted: number };
  },
  async clearRegistrations() {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_clear_registrations");
    if (error) throw new Error(error.message);
    return data as { status: string; deleted: number };
  },
  async clearQuestionBank() {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_clear_question_bank");
    if (error) throw new Error(error.message);
    return data as { status: string; questions_deleted: number; options_deleted: number };
  },

  async confirmImport(input: { entity: ImportEntity; rows: Record<string, unknown>[] }) {
    await requireSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_confirm_import", { p_entity: input.entity, p_rows: input.rows });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The server returned no import result.");
    return data as { entity: ImportEntity; imported: number; updated: number; skipped: number };
  },
};

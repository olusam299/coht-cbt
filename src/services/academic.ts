import { supabase } from "@/lib/supabase";

export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  programmes: ProgrammeRecord[];
}
export interface ProgrammeRecord {
  id: string;
  department_id: string;
  code: string;
  name: string;
  duration_years: number | null;
  is_active: boolean;
}
export interface AcademicSessionRecord {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  is_active: boolean;
}

async function ensureSuperAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error("Authentication required.");
  const { data, error } = await supabase.from("profiles").select("role, is_active").eq("id", userData.user.id).single();
  if (error) throw new Error(error.message);
  if (data.role !== "superadmin" || !data.is_active) throw new Error("SuperAdmin authorization required.");
}

export const academicService = {
  async listStructure(): Promise<DepartmentRecord[]> {
    await ensureSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_list_academic_structure");
    if (error) throw new Error(error.message);
    return (data ?? []) as DepartmentRecord[];
  },
  async listSessions(): Promise<AcademicSessionRecord[]> {
    await ensureSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_list_academic_sessions");
    if (error) throw new Error(error.message);
    return (data ?? []) as AcademicSessionRecord[];
  },
  async createSession(input: { name: string; startDate?: string | null; endDate?: string | null; isCurrent: boolean }): Promise<AcademicSessionRecord> {
    await ensureSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_create_academic_session", {
      p_name: input.name.trim(), p_start_date: input.startDate || null, p_end_date: input.endDate || null, p_is_current: input.isCurrent,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The server returned no academic session.");
    return data as AcademicSessionRecord;
  },
  async setSessionActive(input: { sessionId: string; active: boolean }) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_set_academic_session_active", { p_session_id: input.sessionId, p_is_active: input.active });
    if (error) throw new Error(error.message);
  },
  async setSessionCurrent(sessionId: string) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_set_current_academic_session", { p_session_id: sessionId });
    if (error) throw new Error(error.message);
  },
  async createDepartment(input: { code: string; name: string }): Promise<DepartmentRecord> {
    await ensureSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_create_department", { p_code: input.code.trim().toUpperCase(), p_name: input.name.trim() });
    if (error) throw new Error(error.message); if (!data) throw new Error("The server returned no department."); return data as DepartmentRecord;
  },
  async createProgramme(input: { departmentId: string; code: string; name: string; durationYears?: number | null }): Promise<ProgrammeRecord> {
    await ensureSuperAdmin();
    const { data, error } = await supabase.rpc("superadmin_create_programme", { p_department_id: input.departmentId, p_code: input.code.trim().toUpperCase(), p_name: input.name.trim(), p_duration_years: input.durationYears ?? null });
    if (error) throw new Error(error.message); if (!data) throw new Error("The server returned no programme."); return data as ProgrammeRecord;
  },

  async updateSession(input: { sessionId: string; name: string; startDate: string | null; endDate: string | null }) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_update_academic_session", {
      p_session_id: input.sessionId, p_name: input.name.trim(), p_start_date: input.startDate || null, p_end_date: input.endDate || null,
    });
    if (error) throw new Error(error.message);
  },
  async deleteSession(sessionId: string) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_delete_academic_session", { p_session_id: sessionId });
    if (error) throw new Error(error.message);
  },
  async updateDepartment(input: { departmentId: string; code: string; name: string }) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_update_department", { p_department_id: input.departmentId, p_code: input.code.trim().toUpperCase(), p_name: input.name.trim() });
    if (error) throw new Error(error.message);
  },
  async setDepartmentActive(input: { departmentId: string; active: boolean }) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_set_department_active", { p_department_id: input.departmentId, p_is_active: input.active });
    if (error) throw new Error(error.message);
  },
  async deleteDepartment(departmentId: string) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_delete_department", { p_department_id: departmentId });
    if (error) throw new Error(error.message);
  },
  async updateProgramme(input: { programmeId: string; code: string; name: string; durationYears: number | null }) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_update_programme", { p_programme_id: input.programmeId, p_code: input.code.trim().toUpperCase(), p_name: input.name.trim(), p_duration_years: input.durationYears });
    if (error) throw new Error(error.message);
  },
  async setProgrammeActive(input: { programmeId: string; active: boolean }) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_set_programme_active", { p_programme_id: input.programmeId, p_is_active: input.active });
    if (error) throw new Error(error.message);
  },
  async deleteProgramme(programmeId: string) {
    await ensureSuperAdmin();
    const { error } = await supabase.rpc("superadmin_delete_programme", { p_programme_id: programmeId });
    if (error) throw new Error(error.message);
  },
};

import { supabase } from "@/lib/supabase";

export type ResultScope = "all" | "department" | "examination" | "paper";

export interface ScopeTarget {
  scope: ResultScope;
  departmentId?: string | undefined;
  examId?: string | undefined;
  examCourseId?: string | undefined;
}

export interface ScopeSummary {
  total: number;
  active: number;
  archived: number;
}

export interface ResultsLogRow {
  id: string;
  action: "archive" | "restore" | "delete";
  scopeLabel: string;
  affected: number;
  reason: string | null;
  performedBy: string;
  createdAt: string;
}

const params = (t: ScopeTarget) => ({
  p_scope: t.scope,
  p_department_id: t.departmentId ?? null,
  p_exam_id: t.examId ?? null,
  p_exam_course_id: t.examCourseId ?? null,
});

/** True when the scope has everything it needs to be sent. */
export function scopeReady(t: ScopeTarget): boolean {
  if (t.scope === "all") return true;
  if (t.scope === "department") return Boolean(t.departmentId);
  if (t.scope === "examination") return Boolean(t.examId);
  return Boolean(t.examCourseId);
}

export const resultsAdminService = {
  async summary(target: ScopeTarget): Promise<ScopeSummary> {
    const { data, error } = await supabase.rpc("superadmin_results_scope_summary", params(target));
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(data) ? data[0] : data;
    return { total: Number(row?.total ?? 0), active: Number(row?.active ?? 0), archived: Number(row?.archived ?? 0) };
  },

  async archive(target: ScopeTarget, reason: string): Promise<number> {
    const { data, error } = await supabase.rpc("superadmin_archive_results", { ...params(target), p_reason: reason.trim() || null });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },

  async restore(target: ScopeTarget, reason: string): Promise<number> {
    const { data, error } = await supabase.rpc("superadmin_restore_results", { ...params(target), p_reason: reason.trim() || null });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },

  /** Permanent. The server also insists on the confirmation word. */
  async remove(target: ScopeTarget, reason: string): Promise<number> {
    const { data, error } = await supabase.rpc("superadmin_delete_results", {
      ...params(target),
      p_confirm: "DELETE",
      p_reason: reason.trim() || null,
    });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },

  async log(limit = 8): Promise<ResultsLogRow[]> {
    const { data, error } = await supabase.rpc("superadmin_list_results_admin_log", { p_limit: limit });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      action: row.action,
      scopeLabel: row.scope_label,
      affected: Number(row.affected ?? 0),
      reason: row.reason ?? null,
      performedBy: row.performed_by_name ?? "SuperAdmin",
      createdAt: row.created_at,
    }));
  },
};

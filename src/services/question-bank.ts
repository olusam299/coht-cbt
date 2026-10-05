import { supabase } from "@/lib/supabase";

export type QuestionImportRow = { exam_id:string; question_number:string|number; question_text:string; option_a:string; option_b:string; option_c:string; option_d:string; option_e?:string; correct_option:string };
export type ValidationRow = { row_number:number; status:"valid"|"error"; message:string };

export const questionBankService = {
  async listExams() {
    // Use the same authoritative query used by the working SuperAdmin
    // Examinations page. Do not depend on the separate exam-list RPC here.
    const { data, error } = await supabase
      .from("exams")
      .select("id,title,mode,is_active,question_count,created_at,exam_courses(id,paper_order,courses(code,title))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      mode: e.mode,
      is_active: e.is_active,
      question_count: e.question_count ?? 0,
      exam_courses: e.exam_courses ?? [],
    }));
  },
  async validate(rows: QuestionImportRow[]) {
    const { data, error } = await supabase.rpc("superadmin_validate_question_import", { p_rows: rows });
    if (error) throw new Error(error.message);
    return (data ?? []) as ValidationRow[];
  },
  async confirm(rows: QuestionImportRow[]) {
    const { data, error } = await supabase.rpc("superadmin_confirm_question_import", { p_rows: rows });
    if (error) throw new Error(error.message);
    return data?.[0] ?? { imported:0, updated:0, total_questions:0 };
  },
};

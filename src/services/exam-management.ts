import { supabase } from "@/lib/supabase";
import { academicService } from "@/services/academic";

export const examManagementService = {
  async listSetup() {
    // Academic sessions are protected behind the same SuperAdmin RPC used by
    // Academic Structure. Do not query academic_sessions directly here; RLS
    // or browser permissions can otherwise make a valid session list appear
    // empty in the examination form.
    const [sessions, { data: courses, error: courseError }] = await Promise.all([
      academicService.listSessions(),
      supabase
        .from("courses")
        .select("id,code,title,level,semester,department_id,programme_id")
        .eq("is_active", true)
        .order("code"),
    ]);
    if (courseError) throw new Error(courseError.message);
    return {
      sessions: sessions.filter((session) => session.is_active),
      courses: courses ?? [],
    };
  },

  async list() {
    const { data, error } = await supabase
      .from("exams")
      .select("id,title,mode,duration_minutes,question_count,is_active,show_instant_results,academic_session_id,exam_courses(id,course_id,paper_order,examiner_email,courses(code,title))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((e: any) => ({
      ...e,
      courseCode: e.exam_courses?.[0]?.courses?.code ?? "",
      courses: e.exam_courses ?? [],
    }));
  },

  async create(input: { academicSessionId: string; title: string; mode: string; durationMinutes: number; questionCount: number; isActive: boolean; courseIds: string[] }) {
    const { data, error } = await supabase.rpc("superadmin_create_exam", {
      p_academic_session_id: input.academicSessionId,
      p_title: input.title.trim(),
      p_mode: input.mode,
      p_duration_minutes: input.durationMinutes,
      p_question_count: input.questionCount,
      p_is_active: input.isActive,
      p_course_ids: input.courseIds,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // The four methods below call RPCs that already exist in the backend
  // (superadmin_update_exam, superadmin_delete_exam, superadmin_add_exam_paper,
  // superadmin_remove_exam_paper); they enforce the rules for live exams.
  async update(input: { examId: string; title: string; durationMinutes: number; isActive: boolean; showInstantResults: boolean }) {
    const { error } = await supabase.rpc("superadmin_update_exam", {
      p_exam_id: input.examId,
      p_title: input.title.trim(),
      p_duration_minutes: input.durationMinutes,
      p_is_active: input.isActive,
      p_show_instant_results: input.showInstantResults,
    });
    if (error) throw new Error(error.message);
  },

  async remove(examId: string) {
    const { error } = await supabase.rpc("superadmin_delete_exam", { p_exam_id: examId });
    if (error) throw new Error(error.message);
  },

  async addPaper(input: { examId: string; courseId: string }) {
    const { error } = await supabase.rpc("superadmin_add_exam_paper", { p_exam_id: input.examId, p_course_id: input.courseId });
    if (error) throw new Error(error.message);
  },

  async removePaper(examCourseId: string) {
    const { error } = await supabase.rpc("superadmin_remove_exam_paper", { p_exam_course_id: examCourseId });
    if (error) throw new Error(error.message);
  },
};

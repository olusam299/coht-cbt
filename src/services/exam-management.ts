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
      .select("id,title,mode,duration_minutes,question_count,is_active,academic_session_id,exam_courses(id,paper_order,courses(code,title))")
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
};

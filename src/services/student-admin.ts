import { supabase } from "@/lib/supabase";

export interface CourseChoice {
  courseId: string;
  code: string;
  title: string;
  level: number | null;
  semester: number | null;
  creditUnits: number | null;
  departmentCode: string | null;
  programmeCode: string | null;
  /** The course belongs to the student's own programme (cadre). */
  matchesProgramme: boolean;
  alreadyRegistered: boolean;
}

export const REGISTRATION_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "resit", label: "Resit" },
  { value: "carry_over", label: "Carry-over" },
  { value: "special", label: "Special" },
] as const;

/** Single-student operations (bulk work stays in the imports). */
export const studentAdminService = {
  async createStudent(input: { regNo: string; fullName: string; programmeId: string; level: number | null }): Promise<string> {
    const { data, error } = await supabase.rpc("superadmin_create_student", {
      p_reg_no: input.regNo,
      p_full_name: input.fullName,
      p_programme_id: input.programmeId,
      p_level: input.level,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },

  async listCoursesForStudent(input: { studentId: string; sessionId: string | null; allDepartments: boolean }): Promise<CourseChoice[]> {
    const { data, error } = await supabase.rpc("superadmin_list_courses_for_student", {
      p_student_id: input.studentId,
      p_academic_session_id: input.sessionId,
      p_all_departments: input.allDepartments,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((row) => ({
      courseId: row.course_id,
      code: row.code,
      title: row.title,
      level: row.level ?? null,
      semester: row.semester ?? null,
      creditUnits: row.credit_units ?? null,
      departmentCode: row.department_code ?? null,
      programmeCode: row.programme_code ?? null,
      matchesProgramme: Boolean(row.matches_programme),
      alreadyRegistered: Boolean(row.already_registered),
    }));
  },

  async registerCourses(input: { studentId: string; courseIds: string[]; sessionId: string; registrationType: string }) {
    const { data, error } = await supabase.rpc("superadmin_register_student_courses", {
      p_student_id: input.studentId,
      p_course_ids: input.courseIds,
      p_academic_session_id: input.sessionId,
      p_registration_type: input.registrationType,
    });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(data) ? data[0] : data;
    return { added: Number(row?.added ?? 0), skipped: Number(row?.skipped ?? 0) };
  },
};

import { functionErrorMessage } from "@/lib/function-error";
import { supabase } from "@/lib/supabase";

export type StudentOtpRow = {
  student_id: string;
  full_name: string;
  reg_no: string;
  department_id: string;
  department_code: string;
  department_name: string;
  level: number | null;
  current_otp: string;
  otp_issued_at: string | null;
  activated_courses: { code: string; title: string }[];
};

/** Row returned by the manage-student-otp edge function. */
export type EnsuredOtp = {
  id: string;
  reg_no: string;
  full_name: string;
  otp: string;
  issued_at: string;
};

type Scope = { departmentId?: string | undefined; studentId?: string | undefined };

export const studentOtpService = {
  async listDepartments() {
    const { data, error } = await supabase.rpc("superadmin_list_student_departments");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async list(
    input: { departmentId?: string | undefined; search?: string | undefined } = {},
  ): Promise<StudentOtpRow[]> {
    const { data, error } = await supabase.rpc("superadmin_list_student_otps", {
      p_department_id: input.departmentId || null,
      p_search: input.search?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as StudentOtpRow[];
  },

  async ensureCurrent(input: Scope) {
    const { data, error } = await supabase.functions.invoke("manage-student-otp", {
      body: {
        action: "ensure_current",
        departmentId: input.departmentId || null,
        studentId: input.studentId || null,
      },
    });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.error) throw new Error(String(data.error));
    return data as { students: EnsuredOtp[]; failures: string[] };
  },
};

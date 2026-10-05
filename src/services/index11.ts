import type {
  AdminService,
  AuthService,
  ExamService,
  ProfileService,
  ResultsService,
  SupervisionService,
  SystemService,
} from "./types";
import type { Student } from "@/lib/exam-types";
import type { Role } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

/**
 * Supabase-backed service layer.
 *
 * Important:
 * - No client-side scoring or timer authority.
 * - Exam state is recovered from PostgreSQL RPCs.
 * - Privileged operations use protected admin RPCs.
 * - Operations for which the current database has no authoritative RPC are
 *   rejected rather than silently pretending that they succeeded.
 */

export class BackendNotConnectedError extends Error {
  constructor(operation: string) {
    super(`"${operation}" is not available in the current Supabase backend.`);
    this.name = "BackendNotConnectedError";
  }
}

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("The server returned no data.");
  return data;
}

function firstRow<T>(data: T[] | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("The server returned no matching record.");
  return data[0];
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Authentication required.");
  return data.user.id;
}

async function currentProfile() {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, student_id, display_name, is_active")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  if (!data || !data.is_active) throw new Error("Your account is inactive.");
  return data;
}

async function requireRole(allowed: Role[]) {
  const profile = await currentProfile();
  if (!allowed.includes(profile.role as Role)) {
    throw new Error("You are not authorized to perform this operation.");
  }
  return profile;
}

function toStudent(row: any): Student {
  return {
    id: row.id,
    fullName: row.full_name,
    matricNumber: row.reg_no,
    programme: row.programmes?.name ?? row.programme ?? "",
    level: row.level,
  };
}

export const authService: AuthService = {
  async signIn({ matricNumber, password }) {
    const { data: email, error: mappingError } = await supabase.rpc(
      "student_auth_email",
      { p_reg_no: matricNumber.trim() },
    );

    if (mappingError) throw new Error(mappingError.message);
    if (!email) throw new Error("Unable to resolve matriculation number.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Authentication failed.");

    const profile = await currentProfile();
    if (profile.role !== "student" || !profile.student_id) {
      await supabase.auth.signOut();
      throw new Error("This account is not configured as a student account.");
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, reg_no, full_name, level, programmes(name)")
      .eq("id", profile.student_id)
      .single();

    if (studentError) throw new Error(studentError.message);
    return toStudent(student);
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getCurrentStudent() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!authData.user) return null;

    const profile = await currentProfile();
    if (profile.role !== "student" || !profile.student_id) return null;

    const { data, error } = await supabase
      .from("students")
      .select("id, reg_no, full_name, level, programmes(name)")
      .eq("id", profile.student_id)
      .single();

    if (error) throw new Error(error.message);
    return data ? toStudent(data) : null;
  },

  async getCurrentRole() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!authData.user) return null;

    const profile = await currentProfile();
    return profile.role as Role;
  },
};

export const profileService: ProfileService = {
  async getMyProfile() {
    const profile = await currentProfile();
    if (profile.role !== "student" || !profile.student_id) return null;

    const { data, error } = await supabase
      .from("students")
      .select(`
        id,
        reg_no,
        full_name,
        level,
        programmes(
          name,
          department_id,
          departments(name)
        )
      `)
      .eq("id", profile.student_id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return null;

    /*
     * Photo metadata/storage fields are not part of the currently confirmed
     * academic foundation. Keep this adapter honest until the profile/storage
     * migration exists.
     */
    return {
      studentId: data.id,
      fullName: data.full_name,
      matricNumber: data.reg_no,
      departmentId: data.programmes?.department_id ?? null,
      programme: data.programmes?.name ?? null,
      level: data.level ?? null,
      gender: null,
      photoUrl: null,
      photoChangeCount: 0,
      photoLockedUntilClearance: false,
      onboardingComplete: false,
    };
  },

  async uploadIdentifierPhoto() {
    throw new BackendNotConnectedError("profile.uploadIdentifierPhoto");
  },

  async requestPhotoChangeClearance() {
    throw new BackendNotConnectedError("profile.requestPhotoChangeClearance");
  },
};

export const examService: ExamService = {
  async listExams() {
    await requireRole(["student"]);

    /*
     * Return exam definitions and their course allocations. The UI-specific
     * ExamSummary shape may require additional fields from the existing
     * exam-types contract; this query deliberately avoids inventing values.
     */
    const { data, error } = await supabase
      .from("exams")
      .select(`
        id,
        title,
        mode,
        duration_minutes,
        question_count,
        is_active,
        exam_courses(
          course_id,
          courses(code, title)
        )
      `)
      .eq("is_active", true)
      .order("title");

    if (error) throw new Error(error.message);

    return (data ?? []).map((exam: any) => ({
      id: exam.id,
      title: exam.title,
      courseCode: exam.exam_courses?.[0]?.courses?.code ?? "",
      context: exam.mode,
      durationMinutes: exam.duration_minutes,
      questionCount: exam.question_count,
      opensAt: null,
      closesAt: null,
      status: "available",
    })) as any;
  },

  async startAttempt(examId) {
    await requireRole(["student"]);

    const { data: courses, error: courseError } = await supabase
      .from("exam_courses")
      .select("id, paper_order")
      .eq("exam_id", examId)
      .order("paper_order");

    if (courseError) throw new Error(courseError.message);
    const examCourse = courses?.[0];
    if (!examCourse) throw new Error("No examination paper is configured for this examination.");

    const { data, error } = await supabase.rpc("start_exam_session", {
      p_exam_id: examId,
      p_exam_course_id: examCourse.id,
    });

    const started = firstRow(data, error);

    return this.getAttempt(started.exam_session_id);
  },

  async getAttempt(attemptId) {
    await requireRole(["student"]);

    const { data, error } = await supabase.rpc("get_exam_session_state", {
      p_exam_session_id: attemptId,
    });
    const state = firstRow(data, error);

    // Question options contain the authoritative answer key, so students
    // must never read question_options directly. The secure RPC returns only
    // id/key/text after validating ownership of this exam session.
    const { data: questions, error: questionError } = await supabase.rpc(
      "get_exam_questions",
      { p_exam_session_id: attemptId },
    );

    if (questionError) throw new Error(questionError.message);

    const { data: answers, error: answerError } = await supabase
      .from("answers")
      .select("question_id, selected_option_id")
      .eq("exam_session_id", attemptId);

    if (answerError) throw new Error(answerError.message);

    const answerMap = new Map(
      (answers ?? []).map((a: any) => [a.question_id, a.selected_option_id]),
    );

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, title, duration_minutes, question_count, exam_courses(courses(code, title))")
      .eq("id", state.exam_id)
      .single();

    if (examError) throw new Error(examError.message);

    return {
      attemptId,
      exam: {
        id: exam.id,
        title: exam.title,
        courseCode: exam.exam_courses?.[0]?.courses?.code ?? "",
        context: "",
      },
      questions: (questions ?? []).reduce((acc: any[], row: any) => {
        let question = acc.find((item) => item.id === row.question_id);
        if (!question) {
          question = {
            id: row.question_id,
            number: row.question_number,
            text: row.question_text,
            options: [],
            selectedOptionIds: [],
            flagged: false,
          };
          acc.push(question);
        }
        question.options.push({
          id: row.option_id,
          key: row.option_key,
          text: row.option_text,
        });
        if (answerMap.has(row.question_id)) {
          question.selectedOptionIds = [answerMap.get(row.question_id)];
        }
        return acc;
      }, []),
      answers: Object.fromEntries(
        (answers ?? []).map((a: any) => [a.question_id, [a.selected_option_id]]),
      ),
      flagged: [],
      status: state.session_status === "active" ? "in-progress" : state.session_status,
      strikes: 0,
      expiresAt: new Date(
        new Date(state.started_at).getTime() +
          exam.duration_minutes * 60_000 +
          Number(state.total_paused_seconds ?? 0) * 1000 +
          Number(state.total_extension_seconds ?? 0) * 1000,
      ).toISOString(),
      serverNow: new Date().toISOString(),
      submittedAt: state.submitted_at,
    } as any;
  },

  async saveAnswer({ attemptId, questionId, optionIds }) {
    await requireRole(["student"]);

    if (optionIds.length > 1) {
      throw new Error(
        "The current database supports one selected option per question.",
      );
    }

    const { data, error } = await supabase.rpc("save_exam_answer", {
      p_exam_session_id: attemptId,
      p_question_id: questionId,
      p_selected_option_id: optionIds[0] ?? null,
    });

    requireData(data, error);
  },

  async setFlag() {
    /*
     * The current confirmed schema has no persistent flag column/table and no
     * flag RPC. Do not keep this state only in the browser.
     */
    throw new BackendNotConnectedError("exam.setFlag");
  },

  async heartbeat(attemptId) {
    const { data, error } = await supabase.rpc("get_exam_session_state", {
      p_exam_session_id: attemptId,
    });
    const state = firstRow(data, error);

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("duration_minutes")
      .eq("id", state.exam_id)
      .single();

    if (examError) throw new Error(examError.message);

    const expiresAt = new Date(
      new Date(state.started_at).getTime() +
        exam.duration_minutes * 60_000 +
        Number(state.total_paused_seconds ?? 0) * 1000 +
        Number(state.total_extension_seconds ?? 0) * 1000,
    ).toISOString();

    return {
      expiresAt,
      serverNow: new Date().toISOString(),
    };
  },

  async submitAttempt(attemptId) {
    await requireRole(["student"]);

    const { data: stateData, error: stateError } = await supabase.rpc(
      "get_exam_session_state",
      { p_exam_session_id: attemptId },
    );
    const state = firstRow(stateData, stateError);

    if (!state.exam_session_course_id) {
      throw new Error("No active examination paper was found.");
    }

    const requestId = crypto.randomUUID();

    const { data, error } = await supabase.rpc("submit_exam_paper", {
      p_exam_session_course_id: state.exam_session_course_id,
      p_submission_request_id: requestId,
    });

    const result = firstRow(data, error);

    return {
      attemptId,
      submittedAt: new Date().toISOString(),
      answered: result.correct_answers + result.wrong_answers,
      total:
        result.correct_answers +
        result.wrong_answers +
        result.unanswered_questions,
    };
  },

  async recordSecurityEvent() {
    throw new BackendNotConnectedError("exam.recordSecurityEvent");
  },
};

export const adminService: AdminService = {
  async listAssignedPapers() {
    await requireRole(["admin"]);

    /*
     * Assignment/clearance tables and RPCs were not among the confirmed
     * migrations supplied for this adapter. Do not fabricate them.
     */
    throw new BackendNotConnectedError("admin.listAssignedPapers");
  },

  async listCandidates() {
    await requireRole(["admin"]);
    throw new BackendNotConnectedError("admin.listCandidates");
  },

  async clearStudentIntoPaper() {
    await requireRole(["admin"]);
    throw new BackendNotConnectedError("admin.clearStudentIntoPaper");
  },

  async applyAction({ attemptId, action, note }) {
    await requireRole(["admin"]);

    if (action === "pause") {
      const { error } = await supabase.rpc("pause_exam_session", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    if (action === "resume") {
      const { error } = await supabase.rpc("resume_exam_session", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    throw new BackendNotConnectedError(`admin.applyAction:${action}`);
  },

  async flagForSupervisor() {
    await requireRole(["admin"]);
    throw new BackendNotConnectedError("admin.flagForSupervisor");
  },
};

export const supervisionService: SupervisionService = {
  async listActiveAttempts() {
    await requireRole(["admin", "superadmin"]);
    throw new BackendNotConnectedError("supervision.listActiveAttempts");
  },

  async getAuditTrail() {
    await requireRole(["admin", "superadmin"]);
    throw new BackendNotConnectedError("supervision.getAuditTrail");
  },

  async listSecurityEvents() {
    await requireRole(["admin", "superadmin"]);
    throw new BackendNotConnectedError("supervision.listSecurityEvents");
  },

  async applyAction({ attemptId, action, note }) {
    await requireRole(["admin", "superadmin"]);

    if (action === "resume") {
      const { error } = await supabase.rpc("resume_exam_session", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    if (action === "pause") {
      const { error } = await supabase.rpc("pause_exam_session", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    if (action === "force-submit") {
      const { data: stateData, error: stateError } = await supabase.rpc(
        "admin_get_exam_session_state",
        { p_exam_session_id: attemptId },
      );
      const state = firstRow(stateData, stateError);

      if (!state.exam_session_course_id) {
        throw new Error("No examination paper was found for this session.");
      }

      const { error } = await supabase.rpc("admin_force_submit_exam_paper", {
        p_exam_session_course_id: state.exam_session_course_id,
        p_reason: note?.trim() || "Administrative force submission",
      });

      if (error) throw new Error(error.message);
      return;
    }

    throw new BackendNotConnectedError(`supervision.applyAction:${action}`);
  },
};

export const systemService: SystemService = {
  async listAdmins() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.listAdmins");
  },

  async setAdminActive() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.setAdminActive");
  },

  async changeAdminPassword() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.changeAdminPassword");
  },

  async clearStrikes() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.clearStrikes");
  },

  async setExamMode() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.setExamMode");
  },

  async authorizeResultMailing() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.authorizeResultMailing");
  },

  async addTimeExtension({ attemptId, minutes, note }) {
    await requireRole(["superadmin"]);

    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
      throw new Error("Extension must be between 1 and 240 minutes.");
    }

    const { error } = await supabase.rpc("admin_extend_exam_time", {
      p_exam_session_id: attemptId,
      p_extension_seconds: Math.round(minutes) * 60,
      p_reason: note ?? null,
    });

    if (error) throw new Error(error.message);
  },

  async grantPhotoChangeClearance() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.grantPhotoChangeClearance");
  },
};

export const resultsService: ResultsService = {
  async listResults(filter) {
    await requireRole(["superadmin"]);

    let query = supabase
      .from("exam_results")
      .select(`
        id,
        exam_session_course_id,
        student_id,
        exam_id,
        total_questions,
        correct_answers,
        wrong_answers,
        unanswered_questions,
        score,
        percentage,
        status,
        scored_at,
        students(reg_no, full_name, level, programmes(name, department_id)),
        exams(title, exam_courses(courses(code)))
      `)
      .order("scored_at", { ascending: false });

    if (filter.examId) query = query.eq("exam_id", filter.examId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row: any) =>
        !filter.departmentId ||
        row.students?.programmes?.department_id === filter.departmentId
      )
      .map((row: any) => ({
        attemptId: row.exam_session_course_id,
        studentId: row.student_id,
        fullName: row.students?.full_name ?? "",
        matricNumber: row.students?.reg_no ?? "",
        departmentId: row.students?.programmes?.department_id ?? null,
        courseCode: row.exams?.exam_courses?.[0]?.courses?.code ?? "",
        examTitle: row.exams?.title ?? "",
        scorePercent: row.percentage == null ? null : Number(row.percentage),
        answered:
          Number(row.correct_answers ?? 0) + Number(row.wrong_answers ?? 0),
        total: Number(row.total_questions ?? 0),
        submittedAt: row.scored_at,
        status: row.status,
      }));
  },

  async listRegisteredStudents(filter) {
    await requireRole(["superadmin"]);

    let query = supabase
      .from("students")
      .select(`
        id,
        reg_no,
        full_name,
        level,
        programmes(name, department_id)
      `)
      .eq("is_active", true)
      .order("reg_no");

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row: any) =>
        !filter.departmentId ||
        row.programmes?.department_id === filter.departmentId
      )
      .map((row: any) => ({
        studentId: row.id,
        fullName: row.full_name,
        matricNumber: row.reg_no,
        departmentId: row.programmes?.department_id ?? null,
        programme: row.programmes?.name ?? null,
        level: row.level ?? null,
        photoUrl: null,
      }));
  },

  async exportRegister() {
    throw new BackendNotConnectedError("results.exportRegister");
  },

  async exportResults() {
    throw new BackendNotConnectedError("results.exportResults");
  },
};

export type {
  AdminAccountRow,
  AdminService,
  AuthService,
  ExamMode,
  ExamService,
  PaperAssignment,
  ProfileService,
  RegisteredStudentRow,
  ResultRow,
  ResultsService,
  SecurityLogRow,
  SupervisionService,
  SystemService,
} from "./types";

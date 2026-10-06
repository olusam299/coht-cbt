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

function requireData<T>(data: T | null | undefined, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("The server returned no data.");
  return data;
}

function firstRow<T>(data: T[] | null | undefined, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("The server returned no matching record.");
  return data[0] as T;
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

  async signInStaff({ email, password, expectedRole }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Enter your administrative email address.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Authentication failed.");

    try {
      const profile = await currentProfile();
      const role = profile.role as Role;

      if (role !== expectedRole) {
        await supabase.auth.signOut();
        throw new Error(
          expectedRole === "superadmin"
            ? "This account is not configured as a SuperAdmin account."
            : "This account is not configured as an Admin account.",
        );
      }

      return role;
    } catch (error) {
      // If profile validation fails after authentication, do not leave a
      // partially authenticated privileged session behind.
      await supabase.auth.signOut();
      throw error;
    }
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
    const studentData = data as any;

    /*
     * Photo metadata/storage fields are not part of the currently confirmed
     * academic foundation. Keep this adapter honest until the profile/storage
     * migration exists.
     */
    return {
      studentId: studentData.id,
      fullName: studentData.full_name,
      matricNumber: studentData.reg_no,
      departmentId: studentData.programmes?.department_id ?? null,
      programme: studentData.programmes?.name ?? null,
      level: studentData.level ?? null,
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
    await requireRole(["student", "admin", "superadmin"]);

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
      // The database stores `pharmacy_prenational`; the frontend ExamContext
      // contract uses the hyphenated `pharmacy-prenational`.
      context: exam.mode === "pharmacy_prenational" ? "pharmacy-prenational" : exam.mode,
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

    const started = firstRow<any>(data as any, error);

    return this.getAttempt(started.exam_session_id);
  },

  async getAttempt(attemptId) {
    await requireRole(["student"]);

    const { data, error } = await supabase.rpc("get_exam_session_state", {
      p_exam_session_id: attemptId,
    });
    const state = firstRow<any>(data as any, error);

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
    const examRow = exam as any;

    return {
      attemptId,
      exam: {
        id: exam.id,
        title: exam.title,
        courseCode: examRow.exam_courses?.[0]?.courses?.code ?? "",
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
    const state = firstRow<any>(data as any, error);

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
    const state = firstRow<any>(stateData as any, stateError);

    if (!state.exam_session_course_id) {
      throw new Error("No active examination paper was found.");
    }

    const requestId = crypto.randomUUID();

    const { data, error } = await supabase.rpc("submit_exam_paper", {
      p_exam_session_course_id: state.exam_session_course_id,
      p_submission_request_id: requestId,
    });

    const result = firstRow<any>(data as any, error);

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
    const { data, error } = await supabase.rpc("admin_list_assigned_papers");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      paperId: row.paper_id, examId: row.exam_id, title: row.title,
      courseCode: row.course_code, departmentId: row.department_id,
      sessionLabel: row.session_label ?? "", startsAt: row.starts_at,
      candidateCount: Number(row.candidate_count ?? 0), activeCount: Number(row.active_count ?? 0),
    }));
  },

  async listCandidates(paperId) {
    await requireRole(["admin"]);
    const { data, error } = await supabase.rpc("admin_list_paper_candidates", { p_exam_course_id: paperId });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      attemptId: row.attempt_id ?? `attendance:${row.student_id}`,
      student: { id: row.student_id, fullName: row.full_name, matricNumber: row.reg_no, photoUrl: null, departmentId: row.department_id },
      courseCode: "", examTitle: "", status: row.attempt_status === "paused" ? "paused" : row.attempt_status === "submitted" ? "submitted" : "in-progress",
      answered: 0, total: 0, strikes: Number(row.strikes ?? 0),
      lastEvent: null, expiresAt: "", lastSeenAt: row.attendance_at ?? new Date().toISOString(),
      startedAt: row.attendance_at ?? null, supervisorFlagged: Boolean(row.supervisor_flagged),
    })) as MonitoredAttempt[];
  },

  async clearStudentIntoPaper({ paperId, studentId, note }) {
    await requireRole(["admin"]);
    const { error } = await supabase.rpc("admin_clear_student_into_paper", {
      p_exam_course_id: paperId, p_student_id: studentId, p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async applyAction({ attemptId, action, note }) {
    await requireRole(["admin"]);

    if (action === "pause") {
      const { error } = await supabase.rpc("admin_pause_exam_session_scoped", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    if (action === "resume") {
      const { error } = await supabase.rpc("admin_resume_exam_session_scoped", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    if (action === "wipe-for-restart") {
      const { error } = await supabase.rpc("admin_wipe_exam_paper", { p_exam_session_id: attemptId, p_reason: note ?? "Administrative restart" });
      if (error) throw new Error(error.message); return;
    }
    if (action === "force-submit") {
      const { data: stateData, error: stateError } = await supabase.rpc("admin_get_exam_session_state", { p_exam_session_id: attemptId });
      const state = firstRow<any>(stateData as any, stateError);
      const { error } = await supabase.rpc("admin_force_submit_exam_paper_scoped", { p_exam_session_course_id: state.exam_session_course_id, p_reason: note ?? "Administrative force submission" });
      if (error) throw new Error(error.message); return;
    }
    if (action === "cancel-paper") {
      const { error } = await supabase.rpc("admin_cancel_exam_paper", { p_exam_session_id: attemptId, p_reason: note ?? "Paper cancelled by administrator" });
      if (error) throw new Error(error.message); return;
    }
    throw new BackendNotConnectedError(`admin.applyAction:${action}`);
  },

  async flagForSupervisor({ attemptId, reason }) {
    await requireRole(["admin"]);
    const { error } = await supabase.rpc("admin_flag_for_supervisor", { p_exam_session_id: attemptId, p_reason: reason });
    if (error) throw new Error(error.message);
  },
};

export const supervisionService: SupervisionService = {
  async listActiveAttempts() {
    await requireRole(["admin", "superadmin"]);
    const { data, error } = await supabase.rpc("admin_list_active_attempts");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      attemptId: row.attempt_id,
      student: { id: row.student_id, fullName: row.student_name, matricNumber: row.matric_number, photoUrl: null },
      courseCode: row.course_code ?? "", examTitle: row.exam_title ?? "",
      status: row.status === "paused" ? "paused" : "in-progress", answered: 0, total: 0,
      strikes: Number(row.strikes ?? 0), supervisorFlagged: Boolean(row.supervisor_flagged),
      lastEvent: null, expiresAt: "", lastSeenAt: row.last_event_at ?? new Date().toISOString(),
    })) as MonitoredAttempt[];
  },

  async getAuditTrail(attemptId) {
    await requireRole(["admin", "superadmin"]);
    const { data, error } = await supabase.rpc("supervision_get_audit_trail", { p_exam_session_id: attemptId });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({ id: row.id, occurredAt: row.created_at, attemptId, type: row.event_type, reason: row.event_data?.reason ?? "", strike: Number(row.event_data?.strike ?? 0) })) as SecurityEvent[];
  },

  async listSecurityEvents(filter) {
    await requireRole(["admin", "superadmin"]);
    const { data, error } = await supabase.rpc("supervision_list_security_events", { p_department_id: filter.departmentId ?? null, p_exam_id: filter.examId ?? null, p_min_strike: filter.minStrike ?? 0 });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({ id: row.id, occurredAt: row.occurred_at, attemptId: row.attempt_id, studentName: row.student_name, matricNumber: row.matric_number, courseCode: row.course_code ?? "", examTitle: row.exam_title ?? "", strike: Number(row.strike ?? 0), type: row.event_type, reason: row.reason ?? "", resultingStatus: row.resulting_status })) as SecurityLogRow[];
  },

  async applyAction({ attemptId, action, note }) {
    await requireRole(["admin", "superadmin"]);

    if (action === "resume") {
      const { error } = await supabase.rpc("admin_resume_exam_session_scoped", {
        p_exam_session_id: attemptId,
        p_reason: note ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    if (action === "pause") {
      const { error } = await supabase.rpc("admin_pause_exam_session_scoped", {
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
      const state = firstRow<any>(stateData as any, stateError);

      if (!state.exam_session_course_id) {
        throw new Error("No examination paper was found for this session.");
      }

      const { error } = await supabase.rpc("admin_force_submit_exam_paper_scoped", {
        p_exam_session_course_id: state.exam_session_course_id,
        p_reason: note?.trim() || "Administrative force submission",
      });

      if (error) throw new Error(error.message);
      return;
    }

    if (action === "wipe-for-restart") {
      const { error } = await supabase.rpc("admin_wipe_exam_paper", { p_exam_session_id: attemptId, p_reason: note ?? "Administrative restart" });
      if (error) throw new Error(error.message); return;
    }
    if (action === "cancel-paper") {
      const { error } = await supabase.rpc("admin_cancel_exam_paper", { p_exam_session_id: attemptId, p_reason: note ?? "Paper cancelled" });
      if (error) throw new Error(error.message); return;
    }
    throw new BackendNotConnectedError(`supervision.applyAction:${action}`);
  },
};

async function invokeStaffManagement(body: Record<string, unknown>) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Authentication required.");

  const { data, error } = await supabase.functions.invoke("manage-staff-account", {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const systemService: SystemService = {
  async listAdmins() {
    await requireRole(["superadmin"]);
    const { data, error } = await supabase.rpc("superadmin_list_admins");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({ id: row.id, fullName: row.full_name, email: row.email, active: Boolean(row.active), assignedPapers: Number(row.assigned_papers ?? 0), lastSeenAt: row.last_seen_at }));
  },

  async createAdmin({ fullName, email, password }) {
    await requireRole(["superadmin"]);

    if (fullName.trim().length < 2) throw new Error("Enter the administrator's full name.");
    if (!email.includes("@")) throw new Error("Enter a valid administrative email address.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    await invokeStaffManagement({
      action: "create_admin",
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
  },

  async setAdminActive({ adminId, active }) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_set_admin_active", { p_admin_id: adminId, p_active: active });
    if (error) throw new Error(error.message);
  },

  async changeAdminPassword({ adminId, password }) {
    await requireRole(["superadmin"]);

    if (password.length < 8) throw new Error("Password must be at least 8 characters.");

    await invokeStaffManagement({
      action: "change_password",
      adminId,
      password,
    });
  },

  async listAdminPaperAssignments() {
    await requireRole(["superadmin"]);
    const { data, error } = await supabase.rpc("superadmin_list_admin_paper_assignments");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ assignmentId:r.assignment_id, adminId:r.admin_id, adminName:r.admin_name, adminEmail:r.admin_email, examCourseId:r.exam_course_id, examId:r.exam_id, examTitle:r.exam_title, courseCode:r.course_code, courseTitle:r.course_title, isActive:Boolean(r.is_active), assignedAt:r.assigned_at }));
  },

  async assignAdminPaper({ adminId, examCourseId }) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_assign_admin_paper", { p_admin_id: adminId, p_exam_course_id: examCourseId });
    if (error) throw new Error(error.message);
  },

  async unassignAdminPaper(assignmentId) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_unassign_admin_paper", { p_assignment_id: assignmentId });
    if (error) throw new Error(error.message);
  },

  async clearStrikes({ attemptId, note }) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_clear_strikes", { p_exam_session_id: attemptId, p_note: note });
    if (error) throw new Error(error.message);
  },

  async setExamMode(mode) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_set_exam_mode", { p_mode: mode });
    if (error) throw new Error(error.message);
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

  async setInstantResults(enabled) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_set_instant_results", { p_enabled: enabled });
    if (error) throw new Error(error.message);
  },

  async clearFingerprintBinding() {
    await requireRole(["superadmin"]);
    throw new BackendNotConnectedError("system.clearFingerprintBinding");
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

    // Use the authoritative server-side join for both All Departments and a
    // selected department. This avoids depending on PostgREST relationship
    // shape/RLS when resolving students -> programmes -> departments.
    const departmentId = filter.departmentId?.trim() || null;
    const { data, error } = await supabase.rpc(
      "superadmin_list_registered_students",
      { p_department_id: departmentId },
    );

    if (error) throw new Error(error.message);

    return ((data ?? []) as any[]).map((row: any) => ({
      studentId: row.student_id,
      fullName: row.full_name,
      matricNumber: row.reg_no,
      departmentId: row.department_id ?? null,
      programme: row.programme_name ?? null,
      level: row.level ?? null,
      photoUrl: null,
    }));
  },

  async getStudentDetail(studentId) {
    await requireRole(["superadmin"]);
    const { data, error } = await supabase.rpc("superadmin_get_student_detail", { p_student_id: studentId });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Student record not found.");
    return {
      studentId: row.student_id, fullName: row.full_name, matricNumber: row.reg_no,
      level: row.level ?? null, isActive: Boolean(row.is_active),
      programmeId: row.programme_id ?? null, programmeCode: row.programme_code ?? null, programmeName: row.programme_name ?? null,
      departmentId: row.department_id ?? null, departmentCode: row.department_code ?? null, departmentName: row.department_name ?? null,
      registrations: Array.isArray(row.registrations) ? row.registrations : [],
    };
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

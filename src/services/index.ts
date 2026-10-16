import type {
  AdminService,
  AuthService,
  ExamService,
  ProfileService,
  ResultsService,
  SecurityLogRow,
  SupervisionService,
  SystemService,
} from "./types";
import type { MonitoredAttempt, SecurityEvent } from "@/lib/exam-security";
import { csvExport, printableExport, todayStamp, type ExportColumn } from "@/lib/export-file";
import type { Student } from "@/lib/exam-types";
import type { Role } from "@/lib/roles";
import { DeviceConflictError, getDeviceLabel, isDeviceConflictMessage } from "@/lib/device";
import { functionErrorMessage } from "@/lib/function-error";
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
  // The session is read locally, so these checks keep working during a connection outage.
  // The database enforces every permission regardless of what the browser believes.
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Authentication required.");
  return data.session.user.id;
}

let profileCache: { userId: string; at: number; value: any } | null = null;
const PROFILE_CACHE_MS = 60_000;

async function currentProfile() {
  const userId = await currentUserId();
  if (profileCache && profileCache.userId === userId && Date.now() - profileCache.at < PROFILE_CACHE_MS) {
    return profileCache.value;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, student_id, display_name, is_active")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  if (!data || !data.is_active) throw new Error("Your account is inactive.");
  profileCache = { userId, at: Date.now(), value: data };
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
    profileCache = null;
    const { data: email, error: mappingError } = await supabase.rpc(
      "student_auth_email",
      { p_reg_no: matricNumber.trim() },
    );

    if (mappingError) throw new Error(mappingError.message);
    if (!email) throw new Error("Unable to resolve matriculation number.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      // OTPs are always capital letters and digits, so accept them however they were typed.
      password: password.trim().toUpperCase(),
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Authentication failed.");

    const profile = await currentProfile();
    if (profile.role !== "student" || !profile.student_id) {
      await supabase.auth.signOut();
      throw new Error("This account is not configured as a student account.");
    }

    // One registration number can be active on one device at a time.
    const { error: deviceError } = await supabase.rpc("student_device_ping", { p_label: getDeviceLabel() });
    if (deviceError) {
      await supabase.auth.signOut();
      throw new Error(deviceError.message);
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
    // Free this device for the student's next sign-in; harmless for staff accounts.
    try {
      await supabase.rpc("release_student_device");
    } catch {
      // best effort
    }
    profileCache = null;
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

    const { data: statusData, error: statusError } = await supabase.rpc("get_my_photo_status");
    if (statusError) throw new Error(statusError.message);
    const photo: any = Array.isArray(statusData) ? statusData[0] : statusData;
    const uploads = Number(photo?.upload_count ?? 0);

    let photoUrl: string | null = null;
    if (photo?.photo_path) {
      const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(photo.photo_path, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }

    return {
      studentId: studentData.id,
      fullName: studentData.full_name,
      matricNumber: studentData.reg_no,
      departmentId: studentData.programmes?.department_id ?? null,
      programme: studentData.programmes?.name ?? null,
      level: studentData.level ?? null,
      gender: (photo?.gender ?? null) as "male" | "female" | null,
      photoUrl,
      // The first upload is not a change; the server allows one change after it.
      photoChangeCount: Math.max(0, uploads - 1),
      photoLockedUntilClearance: uploads > 0 && !photo?.can_upload,
      photoRequestPending: Boolean(photo?.request_pending),
      onboardingComplete: uploads > 0,
    };
  },

  async uploadIdentifierPhoto({ blob, gender }) {
    await requireRole(["student"]);
    const form = new FormData();
    form.append("photo", blob, "photo.jpg");
    form.append("gender", gender);

    const { data, error } = await supabase.functions.invoke("upload-student-photo", { body: form });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.error) throw new Error(String(data.error));

    const profile = await this.getMyProfile();
    if (!profile) throw new Error("Your profile could not be loaded after the upload.");
    return profile;
  },

  async requestPhotoChangeClearance(reason) {
    await requireRole(["student"]);
    const { error } = await supabase.rpc("request_photo_change_clearance", { p_reason: reason });
    if (error) throw new Error(error.message);
  },
};


/** Adds signed photo URLs to staff-facing candidate lists. Photos are optional: failures are ignored. */
async function attachPhotoUrls(items: { student: { id: string; photoUrl: string | null } }[]) {
  const ids = [...new Set(items.map((item) => item.student.id))];
  if (!ids.length) return;
  try {
    const { data } = await supabase.rpc("get_student_photo_paths", { p_student_ids: ids });
    const paths = (data ?? []) as { student_id: string; photo_path: string }[];
    if (!paths.length) return;
    const { data: signed } = await supabase.storage
      .from("student-photos")
      .createSignedUrls(paths.map((p) => p.photo_path), 3600);
    const urlByPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));
    const urlByStudent = new Map(paths.map((p) => [p.student_id, urlByPath.get(p.photo_path) ?? null]));
    for (const item of items) item.student.photoUrl = urlByStudent.get(item.student.id) ?? null;
  } catch {
    // the list still works without photos
  }
}

/** exam_session_course id of the paper each attempt is currently sitting. */
const activePaperByAttempt = new Map<string, string>();

function examContext(mode: string | null | undefined) {
  return mode === "pharmacy_prenational" ? "pharmacy-prenational" : (mode ?? "regular");
}

async function activePaperId(attemptId: string): Promise<string> {
  const cached = activePaperByAttempt.get(attemptId);
  if (cached) return cached;

  const { data, error } = await supabase.rpc("get_exam_session_state_v2", {
    p_exam_session_id: attemptId,
  });
  const state = firstRow<any>(data as any, error);
  if (!state.active_exam_session_course_id) {
    throw new Error("No active examination paper was found.");
  }
  activePaperByAttempt.set(attemptId, state.active_exam_session_course_id);
  return state.active_exam_session_course_id;
}

export const examService: ExamService = {
  async listExams() {
    const me = await requireRole(["student", "admin", "superadmin"]);

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

    const list = (data ?? []).map((exam: any) => ({
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
    })) as any[];

    // A student sees their own papers, and an exam whose papers are all submitted shows as Submitted.
    if (me.role === "student") {
      await Promise.all(
        list.map(async (exam) => {
          const { data: papers, error: papersError } = await supabase.rpc("list_my_exam_papers", { p_exam_id: exam.id });
          const rows = (papers ?? []) as { course_code: string; paper_status: string }[];
          if (papersError || !rows.length) return;
          exam.courseCode = rows.map((p) => p.course_code).join(" · ");
          if (rows.every((p) => p.paper_status === "submitted")) exam.status = "completed";
        }),
      );
    }

    return list;
  },

  async startAttempt(examId) {
    await requireRole(["student"]);

    // Papers this student is registered for, with progress. Resume the
    // active paper, otherwise start the first one not yet submitted.
    const { data: paperRows, error: paperError } = await supabase.rpc("list_my_exam_papers", {
      p_exam_id: examId,
    });
    if (paperError) throw new Error(paperError.message);

    const papers = (paperRows ?? []) as any[];
    if (!papers.length) {
      throw new Error("You are not registered for any paper in this examination.");
    }
    const paper =
      papers.find((p) => p.paper_status === "active") ??
      papers.find((p) => p.paper_status !== "submitted");
    if (!paper) {
      throw new Error("You have already submitted every paper in this examination.");
    }

    const { data, error } = await supabase.rpc("start_exam_paper_for_student", {
      p_exam_id: examId,
      p_exam_course_id: paper.exam_course_id,
    });
    const started = firstRow<any>(data as any, error);
    activePaperByAttempt.set(started.exam_session_id, started.exam_session_course_id);

    return this.getAttempt(started.exam_session_id);
  },

  async getAttempt(attemptId) {
    await requireRole(["student"]);

    const { data, error } = await supabase.rpc("get_exam_session_state_v2", {
      p_exam_session_id: attemptId,
    });
    const state = firstRow<any>(data as any, error);

    if (state.session_status === "submitted" || !state.active_exam_session_course_id) {
      throw new Error(
        "There is no active paper in this attempt. It may already have been submitted.",
      );
    }
    const paperId: string = state.active_exam_session_course_id;
    activePaperByAttempt.set(attemptId, paperId);

    // Question options contain the authoritative answer key, so students
    // must never read question_options directly. The secure RPC returns only
    // id/key/text after validating ownership of this exam session and paper.
    const [questionsRes, answersRes, clock, strikesRes, flagsRes, examRes] = await Promise.all([
      supabase.rpc("get_exam_questions_for_student", {
        p_exam_session_id: attemptId,
        p_exam_session_course_id: paperId,
      }),
      supabase
        .from("answers")
        .select("question_id, selected_option_id")
        .eq("exam_session_id", attemptId),
      this.heartbeat(attemptId),
      // Strike count is server-side so a page refresh cannot reset it.
      supabase.rpc("get_exam_strikes", { p_exam_session_id: attemptId }),
      supabase.rpc("get_exam_flags", { p_exam_session_id: attemptId }),
      supabase.from("exams").select("id, title").eq("id", state.exam_id).single(),
    ]);

    if (questionsRes.error) throw new Error(questionsRes.error.message);
    if (answersRes.error) throw new Error(answersRes.error.message);
    if (strikesRes.error) throw new Error(strikesRes.error.message);
    if (flagsRes.error) throw new Error(flagsRes.error.message);
    if (examRes.error) throw new Error(examRes.error.message);

    const questions = (questionsRes.data ?? []).reduce((acc: any[], row: any) => {
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
      question.options.push({ id: row.option_id, key: row.option_key, text: row.option_text });
      return acc;
    }, []);

    // Answers are stored per session; keep only those for this paper so the
    // progress count and navigator are per paper.
    const questionIds = new Set(questions.map((q: any) => q.id));
    const paperAnswers = (answersRes.data ?? []).filter((a: any) => questionIds.has(a.question_id));
    const answerMap = new Map(paperAnswers.map((a: any) => [a.question_id, a.selected_option_id]));
    for (const question of questions) {
      if (answerMap.has(question.id)) question.selectedOptionIds = [answerMap.get(question.id)];
    }

    const papers = ((state.papers ?? []) as any[]).map((p) => ({
      id: p.id,
      examCourseId: p.examCourseId,
      courseCode: p.courseCode,
      courseTitle: p.courseTitle,
      status: p.status,
      paperOrder: p.paperOrder,
    }));
    const activePaper = papers.find((p) => p.id === paperId);
    const context = examContext(state.mode);

    return {
      attemptId,
      exam: {
        id: examRes.data.id,
        title: examRes.data.title,
        courseCode: activePaper?.courseCode ?? "",
        context,
      },
      questions,
      answers: Object.fromEntries(
        paperAnswers.map((a: any) => [a.question_id, [a.selected_option_id]]),
      ),
      flagged: ((flagsRes.data ?? []) as { question_id: string }[])
        .map((row) => row.question_id)
        .filter((id) => questions.some((q: { id: string }) => q.id === id)),
      status: state.session_status === "active" ? "in-progress" : state.session_status,
      strikes: Number(strikesRes.data ?? 0),
      expiresAt: clock.expiresAt,
      serverNow: clock.serverNow,
      submittedAt: null,
      mode: context,
      papers,
      activePaperId: paperId,
    } as any;
  },

  async saveAnswer({ attemptId, questionId, optionIds }) {
    await requireRole(["student"]);

    if (optionIds.length > 1) {
      throw new Error("The current database supports one selected option per question.");
    }

    const { data, error } = await supabase.rpc("save_exam_answer_for_student", {
      p_exam_session_id: attemptId,
      p_exam_session_course_id: await activePaperId(attemptId),
      p_question_id: questionId,
      p_selected_option_id: optionIds[0] ?? null,
    });

    requireData(data, error);
  },

  async switchPaper({ attemptId, examCourseId }) {
    await requireRole(["student"]);

    const { data, error } = await supabase.rpc("get_exam_session_state_v2", {
      p_exam_session_id: attemptId,
    });
    const state = firstRow<any>(data as any, error);

    const { data: started, error: startError } = await supabase.rpc("start_exam_paper_for_student", {
      p_exam_id: state.exam_id,
      p_exam_course_id: examCourseId,
    });
    const row = firstRow<any>(started as any, startError);
    activePaperByAttempt.set(attemptId, row.exam_session_course_id);
  },

  async pingDevice() {
    const { error } = await supabase.rpc("student_device_ping", { p_label: null });
    if (error) {
      if (isDeviceConflictMessage(error.message)) throw new DeviceConflictError(error.message);
      throw new Error(error.message);
    }
  },

  async setFlag({ attemptId, questionId, flagged }) {
    await requireRole(["student"]);
    const { error } = await supabase.rpc("set_exam_question_flag", {
      p_exam_session_id: attemptId,
      p_question_id: questionId,
      p_flagged: flagged,
    });
    if (error) throw new Error(error.message);
  },

  async heartbeat(attemptId) {
    // Deadline, pauses and administrator extensions are all computed in the
    // database; the device clock is never used.
    const { data, error } = await supabase.rpc("get_exam_clock_v2", {
      p_exam_session_id: attemptId,
    });
    const row = firstRow<any>(data as any, error);

    return {
      expiresAt: row.expires_at,
      serverNow: row.server_now,
      status: row.session_status,
    };
  },

  async submitAttempt(attemptId) {
    await requireRole(["student"]);

    // The student wrapper returns progress only; marks come from getResults and
    // are visible solely when the examination allows instant results.
    const { data, error } = await supabase.rpc("submit_exam_paper_for_student", {
      p_exam_session_course_id: await activePaperId(attemptId),
      p_submission_request_id: crypto.randomUUID(),
    });
    const result = firstRow<any>(data as any, error);
    activePaperByAttempt.delete(attemptId);

    const results = await this.getResults(attemptId);

    return {
      attemptId,
      submittedAt: new Date().toISOString(),
      answered: Number(result.answered_questions),
      total: Number(result.total_questions),
      allPapersSubmitted: Boolean(result.all_papers_submitted),
      ...(results.length ? { results } : {}),
    };
  },

  async getResults(attemptId) {
    await requireRole(["student"]);
    // Row-level security returns rows only when the examination shows instant results.
    const { data, error } = await supabase
      .from("exam_results")
      .select("total_questions, correct_answers, percentage, exam_session_courses(exam_courses(courses(code, title)))")
      .eq("exam_session_id", attemptId);
    if (error) return [];
    return ((data ?? []) as any[]).map((row) => {
      const course = row.exam_session_courses?.exam_courses?.courses;
      return {
        courseCode: course?.code ?? "Paper",
        courseTitle: course?.title ?? "",
        correct: Number(row.correct_answers ?? 0),
        total: Number(row.total_questions ?? 0),
        percentage: row.percentage == null ? null : Number(row.percentage),
      };
    });
  },

  async recordSecurityEvent({ attemptId, type, reason }) {
    // The server owns the strike count and pauses the session at strike 3.
    const { error } = await supabase.rpc("record_security_event", {
      p_exam_session_id: attemptId,
      p_event_type: type,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
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
    const rows = (data ?? []).map((row: any) => ({
      attemptId: row.attempt_id ?? `attendance:${row.student_id}`,
      student: { id: row.student_id, fullName: row.full_name, matricNumber: row.reg_no, photoUrl: null, departmentId: row.department_id },
      courseCode: "", examTitle: "", status: row.attempt_status === "paused" ? "paused" : row.attempt_status === "submitted" ? "submitted" : "in-progress",
      answered: 0, total: 0, strikes: Number(row.strikes ?? 0),
      lastEvent: null, expiresAt: "", lastSeenAt: row.attendance_at ?? new Date().toISOString(),
      startedAt: row.attendance_at ?? null, supervisorFlagged: Boolean(row.supervisor_flagged),
    })) as MonitoredAttempt[];
    await attachPhotoUrls(rows);
    return rows;
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
    const rows = (data ?? []).map((row: any) => ({
      attemptId: row.attempt_id,
      student: { id: row.student_id, fullName: row.student_name, matricNumber: row.matric_number, photoUrl: null },
      courseCode: row.course_code ?? "", examTitle: row.exam_title ?? "",
      status: row.status === "paused" ? "paused" : "in-progress", answered: 0, total: 0,
      strikes: Number(row.strikes ?? 0), supervisorFlagged: Boolean(row.supervisor_flagged),
      lastEvent: null, expiresAt: "", lastSeenAt: row.last_event_at ?? new Date().toISOString(),
    })) as MonitoredAttempt[];
    await attachPhotoUrls(rows);
    return rows;
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

  if (error) throw new Error(await functionErrorMessage(error));
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
    if (note.trim().length < 3) throw new Error("Give a reason for clearing the strikes.");
    const { data, error } = await supabase.rpc("superadmin_clear_strikes", { p_exam_session_id: attemptId, p_note: note });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },

  async extendExamTimeBulk({ examId, examCourseId, minutes, reason }) {
    await requireRole(["superadmin"]);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
      throw new Error("Extension must be between 1 and 240 minutes.");
    }
    const { data, error } = await supabase.rpc("superadmin_extend_exam_time_bulk", {
      p_exam_id: examId,
      p_exam_course_id: examCourseId ?? null,
      p_extension_minutes: Math.round(minutes),
      p_reason: reason?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
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

  async sweepExpiredPapers() {
    await requireRole(["superadmin"]);
    const { data, error } = await supabase.rpc("superadmin_sweep_expired_exam_sessions");
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },



  async findStudentIdentity(search) {
    await requireRole(["superadmin"]);
    const { data, error } = await supabase.rpc("superadmin_find_student_identity", { p_search: search });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((row) => ({
      studentId: row.student_id,
      matricNumber: row.reg_no,
      fullName: row.full_name,
      photoUploads: Number(row.photo_uploads ?? 0),
      photoCanUpload: Boolean(row.photo_can_upload),
      hasPhoto: Boolean(row.photo_path),
      deviceLabel: row.device_label ?? null,
      deviceLastSeen: row.device_last_seen ?? null,
      deviceActive: Boolean(row.device_active),
    }));
  },

  async grantPhotoChange(studentId) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_grant_photo_change", { p_student_id: studentId });
    if (error) throw new Error(error.message);
  },

  async releaseStudentDevice(studentId) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_release_student_device", { p_student_id: studentId });
    if (error) throw new Error(error.message);
  },

  async listPhotoRequests() {
    await requireRole(["superadmin"]);
    const { data, error } = await supabase.rpc("superadmin_list_photo_requests");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((row) => ({
      requestId: row.request_id,
      studentId: row.student_id,
      matricNumber: row.reg_no,
      fullName: row.full_name,
      reason: row.reason ?? "",
      requestedAt: row.requested_at,
    }));
  },

  async decidePhotoRequest({ requestId, approve }) {
    await requireRole(["superadmin"]);
    const { error } = await supabase.rpc("superadmin_decide_photo_request", { p_request_id: requestId, p_approve: approve });
    if (error) throw new Error(error.message);
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
        archived_at,
        students(reg_no, full_name, level, programmes(name, department_id)),
        exams(title, exam_courses(courses(code)))
      `)
      .order("scored_at", { ascending: false });

    if (filter.examId) query = query.eq("exam_id", filter.examId);
    if (!filter.includeArchived) query = query.is("archived_at", null);

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
        archived: Boolean(row.archived_at),
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

  async exportRegister({ departmentId, format }) {
    await requireRole(["superadmin"]);

    const students = await resultsService.listRegisteredStudents(departmentId ? { departmentId } : {});
    const { data: departments } = await supabase.rpc("superadmin_list_departments");
    const names = new Map<string, string>(
      ((departments ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]),
    );

    type Row = (typeof students)[number];
    const columns: ExportColumn<Row>[] = [
      { header: "Matric number", value: (r) => r.matricNumber },
      { header: "Full name", value: (r) => r.fullName },
      { header: "Department", value: (r) => names.get(r.departmentId ?? "") ?? "" },
      { header: "Programme", value: (r) => r.programme },
      { header: "Level", value: (r) => r.level },
    ];

    return format === "csv"
      ? csvExport(`student-register-${todayStamp()}.csv`, columns, students)
      : printableExport("Student register", columns, students);
  },

  async exportResults({ departmentId, examId, includeArchived, format }) {
    await requireRole(["superadmin"]);

    const results = await resultsService.listResults({
      ...(departmentId ? { departmentId } : {}),
      ...(examId ? { examId } : {}),
      ...(includeArchived ? { includeArchived } : {}),
    });

    type Row = (typeof results)[number];
    const columns: ExportColumn<Row>[] = [
      { header: "Matric number", value: (r) => r.matricNumber },
      { header: "Full name", value: (r) => r.fullName },
      { header: "Course", value: (r) => r.courseCode },
      { header: "Examination", value: (r) => r.examTitle },
      { header: "Score (%)", value: (r) => (r.scorePercent == null ? "" : r.scorePercent.toFixed(1)) },
      { header: "Answered", value: (r) => r.answered },
      { header: "Questions", value: (r) => r.total },
      { header: "Status", value: (r) => (r.archived ? `${r.status} (archived)` : r.status) },
      { header: "Submitted at", value: (r) => r.submittedAt },
    ];

    return format === "csv"
      ? csvExport(`exam-results-${todayStamp()}.csv`, columns, results)
      : printableExport("Examination results", columns, results);
  },
};

export type {
  AdminAccountRow,
  AdminService,
  AuthService,
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

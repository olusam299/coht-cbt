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
import { SECURITY_EVENT_LABELS } from "@/lib/exam-security";
import {
  DEMO_ME,
  DEMO_PAPERS,
  iso,
  myAttemptFor,
  registeredRows,
  resultRows,
  securityLogRows,
  store,
  toAttemptState,
  toExamSummary,
  toMonitored,
  toPaperAssignment,
} from "./mock-data";

export class BackendNotConnectedError extends Error {
  constructor(operation: string) {
    super(
      `"${operation}" is not connected yet. Wire this call to the Supabase backend before use.`,
    );
    this.name = "BackendNotConnectedError";
  }
}

/**
 * DEMO implementations. They read and mutate the in-memory demo store so the
 * whole product can be navigated before the backend exists. Every one of these
 * is replaced by a server call later; none of it is authoritative.
 */
const latency = <T>(value: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const demoStudent: Student = {
  id: DEMO_ME.id,
  fullName: DEMO_ME.fullName,
  matricNumber: DEMO_ME.matricNumber,
  programme: DEMO_ME.programme,
  level: DEMO_ME.level,
};

export const authService: AuthService = {
  async signIn() {
    return latency(demoStudent);
  },
  async signOut() {
    return latency(undefined);
  },
  async getCurrentStudent() {
    return latency(demoStudent, 150);
  },
  async getCurrentRole() {
    return latency("student" as const, 150);
  },
};

export const profileService: ProfileService = {
  async getMyProfile() {
    return latency({ ...store.profile }, 200);
  },
  async uploadIdentifierPhoto({ blob, gender }) {
    store.profile = {
      ...store.profile,
      gender,
      photoUrl: URL.createObjectURL(blob),
      photoChangeCount: store.profile.photoChangeCount + 1,
      photoLockedUntilClearance: store.profile.photoChangeCount + 1 > 1,
      onboardingComplete: true,
    };
    return latency({ ...store.profile });
  },
  async requestPhotoChangeClearance() {
    return latency(undefined);
  },
};

export const adminService: AdminService = {
  async listAssignedPapers() {
    return latency(DEMO_PAPERS.filter((p) => p.adminAssigned).map(toPaperAssignment));
  },
  async listCandidates(paperId) {
    return latency(
      store.attempts.filter((a) => a.paperId === paperId).map(toMonitored),
    );
  },
  async clearStudentIntoPaper({ paperId, studentId }) {
    const attempt = store.attempts.find(
      (a) => a.paperId === paperId && a.studentId === studentId,
    );
    if (attempt) attempt.startedAt = iso(0);
    return latency(undefined);
  },
  async applyAction({ attemptId, action }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) attempt.status = action === "pause" ? "paused" : "in-progress";
    return latency(undefined);
  },
  async flagForSupervisor({ attemptId }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) attempt.supervisorFlagged = true;
    return latency(undefined);
  },
};

export const resultsService: ResultsService = {
  async listResults(filter) {
    const rows = resultRows().filter(
      (r) => !filter.departmentId || r.departmentId === filter.departmentId,
    );
    return latency(rows);
  },
  async listRegisteredStudents(filter) {
    const rows = registeredRows().filter(
      (r) => !filter.departmentId || r.departmentId === filter.departmentId,
    );
    return latency(rows);
  },
  async exportRegister() {
    throw new BackendNotConnectedError("results.exportRegister");
  },
  async exportResults() {
    throw new BackendNotConnectedError("results.exportResults");
  },
};

export const examService: ExamService = {
  async listExams() {
    return latency(DEMO_PAPERS.map(toExamSummary));
  },
  async startAttempt(examId) {
    const paper = DEMO_PAPERS.find((p) => p.examId === examId);
    const attempt = paper ? myAttemptFor(paper.paperId) : undefined;
    if (!attempt) throw new Error("No attempt registered for this paper.");
    return latency(toAttemptState(attempt));
  },
  async getAttempt(attemptId) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (!attempt) throw new Error("This attempt could not be found.");
    return latency(toAttemptState(attempt), 400);
  },
  async saveAnswer({ attemptId, questionId, optionIds }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) attempt.answers[questionId] = optionIds;
    return latency(undefined, 120);
  },
  async setFlag({ attemptId, questionId, flagged }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) {
      attempt.flagged = flagged
        ? [...new Set([...attempt.flagged, questionId])]
        : attempt.flagged.filter((id) => id !== questionId);
    }
    return latency(undefined, 120);
  },
  async heartbeat(attemptId) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    return latency({ expiresAt: attempt?.expiresAt ?? iso(0), serverNow: iso(0) }, 120);
  },
  async submitAttempt(attemptId) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (!attempt) throw new Error("This attempt could not be found.");
    attempt.status = "submitted";
    attempt.submittedAt = iso(0);
    const total = DEMO_PAPERS.find((p) => p.paperId === attempt.paperId)!.questionCount;
    return latency({
      attemptId,
      submittedAt: attempt.submittedAt,
      answered: Object.values(attempt.answers).filter((v) => v.length > 0).length,
      total,
    });
  },
  async recordSecurityEvent({ attemptId, type, reason, strike }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) {
      attempt.strikes = strike;
      attempt.events.push({
        id: `${attemptId}-ev-${attempt.events.length + 1}`,
        attemptId,
        type,
        reason: reason || SECURITY_EVENT_LABELS[type],
        strike,
        occurredAt: iso(0),
      });
      // A paused paper is held for a supervisor; it is never auto-submitted.
      if (strike >= 3) attempt.status = "paused";
    }
    return latency(undefined, 120);
  },
};

export const supervisionService: SupervisionService = {
  async listActiveAttempts() {
    return latency(
      store.attempts.filter((a) => a.status !== "submitted").map(toMonitored),
    );
  },
  async getAuditTrail(attemptId) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    return latency(attempt ? [...attempt.events] : []);
  },
  async listSecurityEvents(filter) {
    const rows = securityLogRows().filter(
      (r) => !filter.minStrike || r.strike >= filter.minStrike,
    );
    return latency(rows);
  },
  async applyAction({ attemptId, action }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) {
      if (action === "resume") attempt.status = "in-progress";
      if (action === "pause") attempt.status = "paused";
      if (action === "wipe-for-restart") {
        attempt.answers = {};
        attempt.answeredSeed = 0;
        attempt.strikes = 0;
        attempt.events = [];
        attempt.status = "in-progress";
      }
      if (action === "force-submit") {
        attempt.status = "submitted";
        attempt.submittedAt = iso(0);
      }
      // Cancel locks the candidate out for the day and never submits.
      if (action === "cancel-paper") attempt.status = "cancelled";
    }
    return latency(undefined);
  },
};

export const systemService: SystemService = {
  async listAdmins() {
    return latency(store.admins.map((a) => ({ ...a })));
  },
  async setAdminActive({ adminId, active }) {
    const admin = store.admins.find((a) => a.id === adminId);
    if (admin) admin.active = active;
    return latency(undefined);
  },
  async changeAdminPassword() {
    return latency(undefined);
  },
  async clearStrikes({ attemptId }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) {
      attempt.strikes = 0;
      attempt.status = "in-progress";
    }
    return latency(undefined);
  },
  async setExamMode(mode) {
    store.examMode = mode;
    return latency(undefined);
  },
  async authorizeResultMailing() {
    return latency(undefined);
  },
  async addTimeExtension({ attemptId, minutes }) {
    const attempt = store.attempts.find((a) => a.attemptId === attemptId);
    if (!attempt) throw new Error("Attempt not found");
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
      throw new Error("Extension must be between 1 and 240 minutes");
    }
    attempt.expiresAt = new Date(
      new Date(attempt.expiresAt).getTime() + Math.round(minutes) * 60_000,
    ).toISOString();
    attempt.timeExtensionMinutes += Math.round(minutes);
    return latency(undefined);
  },
  async grantPhotoChangeClearance() {
    store.profile = { ...store.profile, photoLockedUntilClearance: false };
    return latency(undefined);
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

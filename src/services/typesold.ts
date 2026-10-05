import type {
  AttemptResult,
  AttemptState,
  ExamSummary,
  Student,
} from "@/lib/exam-types";
import type {
  MonitoredAttempt,
  SecurityEvent,
  SecurityEventType,
  SupervisorAction,
} from "@/lib/exam-security";
import type { Gender, StudentProfile } from "@/lib/student-profile";
import type { ExportFormat } from "@/lib/departments";
import type { Role } from "@/lib/roles";

/**
 * Service contracts consumed by the UI. Implementations will be wired to the
 * existing Supabase backend (server functions + RLS). No client-side scoring,
 * timing authority, or mock data belongs behind these interfaces.
 */

export interface AuthService {
  signIn(credentials: { matricNumber: string; password: string }): Promise<Student>;
  signInStaff(credentials: { email: string; password: string; expectedRole: Extract<Role, "admin" | "superadmin"> }): Promise<Role>;
  signOut(): Promise<void>;
  getCurrentStudent(): Promise<Student | null>;
  /** Role is resolved server-side from the session; never trusted from the client. */
  getCurrentRole(): Promise<Role | null>;
}

/** One-time identifier-photo onboarding and profile reads. */
export interface ProfileService {
  getMyProfile(): Promise<StudentProfile | null>;
  /**
   * Uploads the already cropped + compressed square JPEG. The server enforces
   * the change limit; a further change needs SuperAdmin clearance.
   */
  uploadIdentifierPhoto(input: { blob: Blob; gender: Gender }): Promise<StudentProfile>;
  requestPhotoChangeClearance(reason: string): Promise<void>;
}

export interface ExamService {
  listExams(): Promise<ExamSummary[]>;
  startAttempt(examId: string): Promise<AttemptState>;
  getAttempt(attemptId: string): Promise<AttemptState>;
  saveAnswer(input: {
    attemptId: string;
    questionId: string;
    optionIds: string[];
  }): Promise<void>;
  setFlag(input: {
    attemptId: string;
    questionId: string;
    flagged: boolean;
  }): Promise<void>;
  /** Returns the refreshed server deadline; the client never owns the clock. */
  heartbeat(attemptId: string): Promise<{ expiresAt: string; serverNow: string }>;
  submitAttempt(attemptId: string): Promise<AttemptResult>;
  /**
   * Appends one integrity event to the attempt's audit trail. The reason is
   * always recorded. Pausing at the strike limit is enforced server-side too;
   * a paused paper is NEVER auto-submitted.
   */
  recordSecurityEvent(input: {
    attemptId: string;
    type: SecurityEventType;
    reason: string;
    strike: number;
  }): Promise<void>;
}

/** SuperAdmin live monitoring and intervention. */
export interface SupervisionService {
  listActiveAttempts(): Promise<MonitoredAttempt[]>;
  getAuditTrail(attemptId: string): Promise<SecurityEvent[]>;
  /** Cross-paper strike/security audit feed for the SuperAdmin logs page. */
  listSecurityEvents(filter: {
    departmentId?: string;
    examId?: string;
    minStrike?: number;
  }): Promise<SecurityLogRow[]>;
  /**
   * `cancel-paper` locks the student out for the day and does NOT submit.
   * `wipe-for-restart` clears answers and strikes.
   */
  applyAction(input: {
    attemptId: string;
    action: SupervisorAction;
    note?: string;
  }): Promise<void>;
}

export interface SecurityLogRow {
  id: string;
  occurredAt: string;
  attemptId: string;
  studentName: string;
  matricNumber: string;
  courseCode: string;
  examTitle: string;
  strike: number;
  type: SecurityEventType;
  reason: string;
  /** Attempt state produced by the event, e.g. "paused" on strike 3. */
  resultingStatus: string;
}

export interface AdminAccountRow {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  assignedPapers: number;
  lastSeenAt: string | null;
}

export type ExamMode = "live" | "practice" | "locked";

/**
 * SuperAdmin-only privileged operations. Every one of these is authorised
 * server-side; the console only renders the affordance.
 */
export interface SystemService {
  listAdmins(): Promise<AdminAccountRow[]>;
  setAdminActive(input: { adminId: string; active: boolean }): Promise<void>;
  changeAdminPassword(input: { adminId: string; password: string }): Promise<void>;
  /** Clears strikes beyond the normal limit so a paused paper can resume. */
  clearStrikes(input: { attemptId: string; note: string }): Promise<void>;
  setExamMode(mode: ExamMode): Promise<void>;
  authorizeResultMailing(input: { examId: string }): Promise<void>;
  addTimeExtension(input: { attemptId: string; minutes: number; note?: string }): Promise<void>;
  grantPhotoChangeClearance(input: { studentId: string }): Promise<void>;
}

export interface PaperAssignment {
  paperId: string;
  examId: string;
  title: string;
  courseCode: string;
  departmentId: string | null;
  sessionLabel: string;
  startsAt: string | null;
  candidateCount: number;
  activeCount: number;
}

/**
 * Admin scope: only papers/courses/sessions assigned to the signed-in admin.
 * Admins never read results.
 */
export interface AdminService {
  listAssignedPapers(): Promise<PaperAssignment[]>;
  listCandidates(paperId: string): Promise<MonitoredAttempt[]>;
  /**
   * Clearing a student into a paper records their starting details as the
   * attendance / answering-start record for that sitting.
   */
  clearStudentIntoPaper(input: {
    paperId: string;
    studentId: string;
    note?: string;
  }): Promise<void>;
  /** Admin-scoped subset of supervisor interventions. */
  applyAction(input: {
    attemptId: string;
    action: Extract<SupervisorAction, "resume" | "pause">;
    note?: string;
  }): Promise<void>;
  flagForSupervisor(input: { attemptId: string; reason: string }): Promise<void>;
}

export interface ResultRow {
  attemptId: string;
  studentId: string;
  fullName: string;
  matricNumber: string;
  departmentId: string | null;
  courseCode: string;
  examTitle: string;
  scorePercent: number | null;
  answered: number;
  total: number;
  submittedAt: string | null;
  status: string;
}

export interface RegisteredStudentRow {
  studentId: string;
  fullName: string;
  matricNumber: string;
  departmentId: string | null;
  programme: string | null;
  level: string | null;
  photoUrl: string | null;
}

/** SuperAdmin-only. Results are never exposed to the Admin role. */
export interface ResultsService {
  listResults(filter: { departmentId?: string; examId?: string }): Promise<ResultRow[]>;
  listRegisteredStudents(filter: { departmentId?: string }): Promise<RegisteredStudentRow[]>;
  /** Returns a download URL produced server-side; the client never builds files. */
  exportRegister(input: {
    departmentId?: string;
    format: ExportFormat;
  }): Promise<{ url: string }>;
  exportResults(input: {
    departmentId?: string;
    examId?: string;
    format: ExportFormat;
  }): Promise<{ url: string }>;
}
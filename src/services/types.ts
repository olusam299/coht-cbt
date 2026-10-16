import type {
  AttemptResult,
  PaperResult,
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
import type { ExportResult } from "@/lib/export-file";
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
  /** Tells the server this browser is still the student's active device; throws DeviceConflictError if another one is. */
  pingDevice(): Promise<void>;
  heartbeat(
    attemptId: string,
  ): Promise<{ expiresAt: string; serverNow: string; status: string }>;
  /** Pharmacy PreNational: make another paper of the same sitting the active one. */
  switchPaper(input: { attemptId: string; examCourseId: string }): Promise<void>;
  submitAttempt(attemptId: string): Promise<AttemptResult>;
  /** The candidate's own marks; empty unless the examination allows instant results. */
  getResults(attemptId: string): Promise<PaperResult[]>;
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


/**
 * SuperAdmin-only privileged operations. Every one of these is authorised
 * server-side; the console only renders the affordance.
 */
export interface StudentIdentityRow {
  studentId: string;
  matricNumber: string;
  fullName: string;
  photoUploads: number;
  photoCanUpload: boolean;
  hasPhoto: boolean;
  deviceLabel: string | null;
  deviceLastSeen: string | null;
  deviceActive: boolean;
}

export interface PhotoRequestRow {
  requestId: string;
  studentId: string;
  matricNumber: string;
  fullName: string;
  reason: string;
  requestedAt: string;
}

export interface SystemService {
  listAdmins(): Promise<AdminAccountRow[]>;
  createAdmin(input: { fullName: string; email: string; password: string }): Promise<void>;
  setAdminActive(input: { adminId: string; active: boolean }): Promise<void>;
  changeAdminPassword(input: { adminId: string; password: string }): Promise<void>;
  /** Clears strikes beyond the normal limit so a paused paper can resume. */
  /** Returns how many strikes were cleared. */
  clearStrikes(input: { attemptId: string; note: string }): Promise<number>;
  /** Adds time to every active or paused sitting of an examination (optionally one paper). Returns how many were extended. */
  extendExamTimeBulk(input: { examId: string; examCourseId?: string | undefined; minutes: number; reason?: string | undefined }): Promise<number>;
  /** Submits papers whose server deadline has passed; returns how many were submitted. */
  sweepExpiredPapers(): Promise<number>;
  addTimeExtension(input: { attemptId: string; minutes: number; note?: string }): Promise<void>;
  /** Finds students by matric number or name, with their photo and device status. */
  findStudentIdentity(search: string): Promise<StudentIdentityRow[]>;
  /** Allows one more photo upload for a student who has used their changes. */
  grantPhotoChange(studentId: string): Promise<void>;
  /** Frees a student's registration number so they can sign in on another device. */
  releaseStudentDevice(studentId: string): Promise<void>;
  listPhotoRequests(): Promise<PhotoRequestRow[]>;
  decidePhotoRequest(input: { requestId: string; approve: boolean }): Promise<void>;
  listAdminPaperAssignments(): Promise<AdminPaperAssignmentRow[]>;
  assignAdminPaper(input: { adminId: string; examCourseId: string }): Promise<void>;
  unassignAdminPaper(assignmentId: string): Promise<void>;
}

export interface AdminPaperAssignmentRow {
  assignmentId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  examCourseId: string;
  examId: string;
  examTitle: string;
  courseCode: string;
  courseTitle: string;
  isActive: boolean;
  assignedAt: string;
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
  archived: boolean;
}

export interface StudentRegistrationDetail {
  registration_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  course_level: number | null;
  semester: number | null;
  credit_units: number | null;
  academic_session_id: string | null;
  academic_session_name: string | null;
  registration_type: string | null;
  is_active: boolean;
}

export interface RegisteredStudentDetail {
  studentId: string;
  fullName: string;
  matricNumber: string;
  level: number | null;
  isActive: boolean;
  programmeId: string | null;
  programmeCode: string | null;
  programmeName: string | null;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  registrations: StudentRegistrationDetail[];
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
  listResults(filter: { departmentId?: string; examId?: string; includeArchived?: boolean }): Promise<ResultRow[]>;
  listRegisteredStudents(filter: { departmentId?: string }): Promise<RegisteredStudentRow[]>;
  getStudentDetail(studentId: string): Promise<RegisteredStudentDetail>;
  /** Builds the file in the browser from live registry/results data. */
  exportRegister(input: {
    departmentId?: string;
    format: ExportFormat;
  }): Promise<ExportResult>;
  exportResults(input: {
    departmentId?: string;
    examId?: string;
    includeArchived?: boolean;
    format: ExportFormat;
  }): Promise<ExportResult>;
}
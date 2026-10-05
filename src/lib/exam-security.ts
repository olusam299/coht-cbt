/**
 * Security / integrity model for the CBT engine.
 *
 * Rule (strict): focus-loss style events (window blur, tab switch, page
 * visibility change, notification interrupts) each raise a WARNING strike.
 * Strikes 1 and 2 warn the candidate. Strike 3 PAUSES the paper — it must
 * never submit the paper. Only a supervisor can resume, wipe, force-submit
 * or cancel from there.
 */

export type SecurityEventType =
  | "window-blur"
  | "tab-hidden"
  | "visibility-change"
  | "notification-interrupt"
  | "fullscreen-exit"
  | "context-menu"
  | "copy-attempt";

export const SECURITY_EVENT_LABELS: Record<SecurityEventType, string> = {
  "window-blur": "Left the exam window",
  "tab-hidden": "Switched away from the exam tab",
  "visibility-change": "Exam screen was hidden",
  "notification-interrupt": "A notification interrupted the exam",
  "fullscreen-exit": "Exited full screen",
  "context-menu": "Opened the browser context menu",
  "copy-attempt": "Attempted to copy exam content",
};

/** Number of strikes after which the paper is paused (never submitted). */
export const MAX_STRIKES = 3;

export interface SecurityEvent {
  id: string;
  attemptId: string;
  type: SecurityEventType;
  /** Human-readable reason recorded on the audit trail. */
  reason: string;
  /** Strike number this event produced (1-based). */
  strike: number;
  occurredAt: string;
}

export type AttemptStatus =
  | "in-progress"
  | "paused"
  | "submitted"
  | "cancelled"
  | "expired";

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  "in-progress": "In progress",
  paused: "Paused",
  submitted: "Submitted",
  cancelled: "Cancelled",
  expired: "Time expired",
};

/** Supervisor interventions available from SuperAdmin monitoring. */
export type SupervisorAction =
  | "resume"
  | "pause"
  | "wipe-for-restart"
  | "force-submit"
  | "cancel-paper";

export const SUPERVISOR_ACTION_LABELS: Record<SupervisorAction, string> = {
  resume: "Resume",
  pause: "Pause",
  "wipe-for-restart": "Wipe for restart",
  "force-submit": "Force submit",
  "cancel-paper": "Cancel paper",
};

export const SUPERVISOR_ACTION_DESCRIPTIONS: Record<SupervisorAction, string> = {
  resume: "Lift the pause and let the candidate continue the paper.",
  pause: "Hold the paper and the clock until a supervisor resumes it.",
  "wipe-for-restart": "Clear all answers and strikes so the paper can be restarted.",
  "force-submit": "Submit the paper on the candidate's behalf and score it.",
  "cancel-paper":
    "Void the sitting and lock the candidate out for the day. The paper is NOT submitted.",
};

export interface MonitoredAttempt {
  attemptId: string;
  student: {
    id: string;
    fullName: string;
    matricNumber: string;
    photoUrl: string | null;
    gender?: "male" | "female" | null;
    departmentId?: string | null;
  };
  examTitle: string;
  courseCode: string;
  paperId?: string;
  status: AttemptStatus;
  answered: number;
  total: number;
  strikes: number;
  lastEvent: SecurityEvent | null;
  expiresAt: string;
  lastSeenAt: string;
  /** Attendance / answering-start record created when an admin clears them in. */
  startedAt?: string | null;
  /** Raised by an admin asking a supervisor to look at this candidate. */
  supervisorFlagged?: boolean;
  /** Total supervisor-granted extension minutes for this sitting. */
  timeExtensionMinutes?: number;
}

/** Candidates needing attention sort first in every monitoring surface. */
export function attentionScore(attempt: MonitoredAttempt): number {
  let score = 0;
  if (attempt.status === "paused") score += 100;
  if (attempt.supervisorFlagged) score += 60;
  score += attempt.strikes * 20;
  if (attempt.status === "cancelled" || attempt.status === "expired") score += 10;
  return score;
}

export function sortByAttention(list: MonitoredAttempt[]): MonitoredAttempt[] {
  return [...list].sort((a, b) => attentionScore(b) - attentionScore(a));
}

export function formatRemaining(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms)) return "--:--";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
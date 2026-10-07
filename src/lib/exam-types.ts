/** Domain model for the College of Health CBT portal. */
import type { AttemptStatus } from "./exam-security";

export type ExamContext = "regular" | "pharmacy-prenational" | "continuous";

export const EXAM_CONTEXT_LABELS: Record<ExamContext, string> = {
  regular: "Regular",
  "pharmacy-prenational": "Pharmacy PreNational",
  continuous: "Continuous",
};

export interface Student {
  id: string;
  fullName: string;
  matricNumber: string;
  programme: string | null;
  level: string | null;
}

export interface ExamSummary {
  id: string;
  title: string;
  courseCode: string;
  context: ExamContext;
  durationMinutes: number;
  questionCount: number;
  opensAt: string | null;
  closesAt: string | null;
  status: "available" | "scheduled" | "closed" | "completed";
  attemptId?: string;
  scorePercent?: number | null;
}

export type QuestionType = "single-choice" | "multiple-choice" | "true-false";

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface Question {
  id: string;
  index: number;
  type: QuestionType;
  text: string;
  imageUrl?: string | null;
  options: QuestionOption[];
}

export interface AttemptPaper {
  /** exam_session_course id: the candidate's instance of this paper. */
  id: string;
  /** exam_course id: the paper definition. */
  examCourseId: string;
  courseCode: string;
  courseTitle: string;
  status: "available" | "active" | "submitted";
  paperOrder: number;
}

export interface AttemptState {
  attemptId: string;
  exam: {
    id: string;
    title: string;
    courseCode: string;
    context: ExamContext;
  };
  questions: Question[];
  /** questionId -> selected option ids */
  answers: Record<string, string[]>;
  flagged: string[];
  /** Lifecycle state owned by the server. */
  status: AttemptStatus;
  /** Integrity strikes already recorded on the server for this attempt. */
  strikes: number;
  /** Server-authoritative deadline (ISO 8601, UTC). */
  expiresAt: string;
  /** Server clock at the time this payload was produced (ISO 8601, UTC). */
  serverNow: string;
  submittedAt: string | null;
  /** Examination mode; Pharmacy PreNational shows a paper switcher. */
  mode?: ExamContext;
  papers?: AttemptPaper[];
  activePaperId?: string;
}

export interface AttemptResult {
  attemptId: string;
  submittedAt: string;
  answered: number;
  total: number;
  /** false when more papers remain (Continuous mode); the candidate stays signed in. */
  allPapersSubmitted?: boolean;
}
/**
 * DEMO DATA ONLY.
 *
 * This module exists so the whole UI can be clicked through before the
 * examination backend is wired in. Nothing here is authoritative: timing,
 * scoring, strike enforcement and role checks all move server-side later.
 * Keep it isolated behind the service interfaces in `./types`.
 */
import type {
  AttemptState,
  ExamContext,
  ExamSummary,
  Question,
} from "@/lib/exam-types";
import type {
  MonitoredAttempt,
  SecurityEvent,
  SecurityEventType,
} from "@/lib/exam-security";
import { SECURITY_EVENT_LABELS } from "@/lib/exam-security";
import type { AttemptStatus } from "@/lib/exam-security";
import type { Gender, StudentProfile } from "@/lib/student-profile";
import type {
  AdminAccountRow,
  PaperAssignment,
  RegisteredStudentRow,
  ResultRow,
  SecurityLogRow,
} from "./types";

export const DEMO_NOTICE =
  "Demo data — not authoritative. Live values arrive with the examination backend.";

const minutes = (n: number) => n * 60_000;

export function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

export interface DemoStudent {
  id: string;
  fullName: string;
  matricNumber: string;
  departmentId: string;
  programme: string;
  level: string;
  gender: Gender;
  photoUrl: string | null;
}

export const DEMO_STUDENTS: DemoStudent[] = [
  ["Samuel Adeyemi", "PHT/22/0431", "pharmacy", "male"],
  ["Aisha Bello", "PHT/22/0442", "pharmacy", "female"],
  ["Chidera Okonkwo", "PHT/22/0455", "pharmacy", "female"],
  ["Tunde Balogun", "NUR/23/1108", "nursing", "male"],
  ["Grace Effiong", "NUR/23/1119", "nursing", "female"],
  ["Halima Yusuf", "NUR/23/1127", "nursing", "female"],
  ["Emeka Nwosu", "CHO/22/0703", "community-health", "male"],
  ["Blessing Ikpe", "CHO/22/0714", "community-health", "female"],
  ["Ibrahim Sani", "CHO/22/0722", "community-health", "male"],
  ["Folake Ogunleye", "MLT/23/0910", "medical-lab", "female"],
  ["Peter Danjuma", "MLT/23/0921", "medical-lab", "male"],
  ["Ngozi Umeh", "HIM/23/0508", "health-information", "female"],
  ["Yakubu Musa", "EHT/22/0316", "environmental-health", "male"],
  ["Rita Akpan", "HIM/23/0517", "health-information", "female"],
].map(([fullName, matricNumber, departmentId, gender], i) => ({
  id: `stu-${i + 1}`,
  fullName: fullName as string,
  matricNumber: matricNumber as string,
  departmentId: departmentId as string,
  programme: "National Diploma",
  level: i % 3 === 0 ? "ND II" : "ND I",
  gender: gender as Gender,
  photoUrl: null,
}));

/** The signed-in demo student for the student-facing screens. */
export const DEMO_ME = DEMO_STUDENTS[0]!;

export const DEMO_PROFILE: StudentProfile = {
  studentId: DEMO_ME.id,
  fullName: DEMO_ME.fullName,
  matricNumber: DEMO_ME.matricNumber,
  departmentId: DEMO_ME.departmentId,
  programme: DEMO_ME.programme,
  level: DEMO_ME.level,
  gender: DEMO_ME.gender,
  photoUrl: null,
  photoChangeCount: 0,
  photoLockedUntilClearance: false,
  onboardingComplete: false,
};

export interface DemoPaper {
  paperId: string;
  examId: string;
  title: string;
  courseCode: string;
  context: ExamContext;
  departmentId: string;
  sessionLabel: string;
  durationMinutes: number;
  questionCount: number;
  status: ExamSummary["status"];
  adminAssigned: boolean;
}

export const DEMO_PAPERS: DemoPaper[] = [
  {
    paperId: "pap-1",
    examId: "exm-1",
    title: "Pharmaceutics & Dispensing",
    courseCode: "PHT 201",
    context: "pharmacy-prenational",
    departmentId: "pharmacy",
    sessionLabel: "2025/2026 · Morning session",
    durationMinutes: 60,
    questionCount: 40,
    status: "available",
    adminAssigned: true,
  },
  {
    paperId: "pap-2",
    examId: "exm-2",
    title: "Fundamentals of Nursing Practice",
    courseCode: "NUR 104",
    context: "regular",
    departmentId: "nursing",
    sessionLabel: "2025/2026 · Morning session",
    durationMinutes: 90,
    questionCount: 50,
    status: "available",
    adminAssigned: true,
  },
  {
    paperId: "pap-3",
    examId: "exm-3",
    title: "Primary Health Care Delivery",
    courseCode: "CHO 210",
    context: "continuous",
    departmentId: "community-health",
    sessionLabel: "2025/2026 · Continuous assessment",
    durationMinutes: 30,
    questionCount: 20,
    status: "scheduled",
    adminAssigned: false,
  },
  {
    paperId: "pap-4",
    examId: "exm-4",
    title: "Clinical Chemistry I",
    courseCode: "MLT 202",
    context: "regular",
    departmentId: "medical-lab",
    sessionLabel: "2025/2026 · Afternoon session",
    durationMinutes: 60,
    questionCount: 40,
    status: "completed",
    adminAssigned: false,
  },
];

const QUESTION_SEEDS: Array<{ text: string; options: string[]; type?: Question["type"] }> = [
  {
    text: "Which route of administration bypasses first-pass hepatic metabolism?",
    options: ["Oral", "Sublingual", "Rectal (upper)", "Enteric-coated oral"],
  },
  {
    text: "The normal adult resting respiratory rate range (breaths per minute) is:",
    options: ["6–10", "12–20", "22–30", "30–40"],
  },
  {
    text: "Which of the following are components of primary health care? (Select all that apply)",
    options: [
      "Health education",
      "Immunisation",
      "Specialist neurosurgery",
      "Safe water and sanitation",
    ],
    type: "multiple-choice",
  },
  {
    text: "Universal precautions should be applied to every patient regardless of diagnosis.",
    options: ["True", "False"],
    type: "true-false",
  },
  {
    text: "A drug with a narrow therapeutic index requires:",
    options: [
      "No monitoring",
      "Plasma level monitoring",
      "Doubling of the dose",
      "Administration with food only",
    ],
  },
  {
    text: "The first step in the nursing process is:",
    options: ["Planning", "Assessment", "Evaluation", "Implementation"],
  },
  {
    text: "Which storage condition is correct for most vaccines in the cold chain?",
    options: ["-20 °C freezer", "2–8 °C refrigerator", "Room temperature", "Above 25 °C"],
  },
  {
    text: "Oral rehydration salts principally work by:",
    options: [
      "Killing enteric pathogens",
      "Sodium-coupled glucose absorption",
      "Slowing gut motility",
      "Neutralising gastric acid",
    ],
  },
];

const LETTERS = ["A", "B", "C", "D", "E"];

/** Deterministic per-paper question set so navigation and progress stay stable. */
export function buildQuestions(examId: string, count: number): Question[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = QUESTION_SEEDS[i % QUESTION_SEEDS.length]!;
    return {
      id: `${examId}-q${i + 1}`,
      index: i,
      type: seed.type ?? "single-choice",
      text: seed.text,
      options: seed.options.map((text, oi) => ({
        id: `${examId}-q${i + 1}-o${oi + 1}`,
        label: LETTERS[oi] ?? String(oi + 1),
        text,
      })),
    };
  });
}

interface DemoAttempt {
  attemptId: string;
  paperId: string;
  studentId: string;
  status: AttemptStatus;
  answers: Record<string, string[]>;
  flagged: string[];
  strikes: number;
  events: SecurityEvent[];
  expiresAt: string;
  startedAt: string | null;
  supervisorFlagged: boolean;
  submittedAt: string | null;
  answeredSeed: number;
  timeExtensionMinutes: number;
}

function seededEvent(
  attemptId: string,
  type: SecurityEventType,
  strike: number,
  agoMs: number,
): SecurityEvent {
  return {
    id: `${attemptId}-ev${strike}`,
    attemptId,
    type,
    reason: SECURITY_EVENT_LABELS[type],
    strike,
    occurredAt: iso(-agoMs),
  };
}

function makeAttempts(): DemoAttempt[] {
  const rows: DemoAttempt[] = [];
  const plan: Array<[paperId: string, studentIdx: number[], ]> = [
    ["pap-1", [0, 1, 2]],
    ["pap-2", [3, 4, 5]],
    ["pap-3", [6, 7, 8]],
    ["pap-4", [9, 10, 11, 12, 13]],
  ];
  let n = 0;
  for (const [paperId, indices] of plan) {
    const paper = DEMO_PAPERS.find((p) => p.paperId === paperId)!;
    for (const idx of indices) {
      n += 1;
      const student = DEMO_STUDENTS[idx]!;
      const strikes = n % 7 === 0 ? 3 : n % 3 === 0 ? 1 : 0;
      const status: AttemptStatus =
        paper.status === "completed"
          ? "submitted"
          : strikes >= 3
            ? "paused"
            : paper.status === "scheduled"
              ? "in-progress"
              : "in-progress";
      const events: SecurityEvent[] = [];
      const types: SecurityEventType[] = ["window-blur", "tab-hidden", "visibility-change"];
      for (let s = 1; s <= strikes; s += 1) {
        events.push(seededEvent(`att-${n}`, types[(s - 1) % types.length]!, s, minutes(s * 4)));
      }
      rows.push({
        attemptId: `att-${n}`,
        paperId,
        studentId: student.id,
        status,
        answers: {},
        flagged: [],
        strikes,
        events,
        expiresAt: iso(minutes(paper.durationMinutes - (n % 5) * 7)),
        startedAt: n % 4 === 0 ? null : iso(-minutes(12 + n)),
        supervisorFlagged: n % 5 === 0,
        submittedAt: paper.status === "completed" ? iso(-minutes(90)) : null,
        timeExtensionMinutes: 0,
        answeredSeed: (n * 7) % paper.questionCount,
      });
    }
  }
  return rows;
}

/** Mutable in-memory demo store; resets on reload. */
export const store = {
  profile: { ...DEMO_PROFILE },
  attempts: makeAttempts(),
  admins: [
    {
      id: "adm-1",
      fullName: "Mrs. Adebisi Lawal",
      email: "a.lawal@coht.edu.ng",
      active: true,
      assignedPapers: 2,
      lastSeenAt: iso(-minutes(4)),
    },
    {
      id: "adm-2",
      fullName: "Mr. Chuka Eze",
      email: "c.eze@coht.edu.ng",
      active: true,
      assignedPapers: 1,
      lastSeenAt: iso(-minutes(38)),
    },
    {
      id: "adm-3",
      fullName: "Mrs. Zainab Idris",
      email: "z.idris@coht.edu.ng",
      active: false,
      assignedPapers: 0,
      lastSeenAt: null,
    },
  ] as AdminAccountRow[],
  examMode: "live" as "live" | "practice" | "locked",
};

export function paperOf(attempt: DemoAttempt): DemoPaper {
  return DEMO_PAPERS.find((p) => p.paperId === attempt.paperId)!;
}

export function studentOf(attempt: DemoAttempt): DemoStudent {
  return DEMO_STUDENTS.find((s) => s.id === attempt.studentId)!;
}

export function answeredCount(attempt: DemoAttempt): number {
  const live = Object.values(attempt.answers).filter((v) => v.length > 0).length;
  return Math.max(live, attempt.answeredSeed);
}

export function toMonitored(attempt: DemoAttempt): MonitoredAttempt {
  const paper = paperOf(attempt);
  const student = studentOf(attempt);
  return {
    attemptId: attempt.attemptId,
    student: {
      id: student.id,
      fullName: student.fullName,
      matricNumber: student.matricNumber,
      photoUrl: student.photoUrl,
      gender: student.gender,
      departmentId: student.departmentId,
    },
    examTitle: paper.title,
    courseCode: paper.courseCode,
    paperId: paper.paperId,
    status: attempt.status,
    answered: answeredCount(attempt),
    total: paper.questionCount,
    strikes: attempt.strikes,
    lastEvent: attempt.events.at(-1) ?? null,
    expiresAt: attempt.expiresAt,
    lastSeenAt: iso(-minutes(1)),
    startedAt: attempt.startedAt ?? null,
    supervisorFlagged: attempt.supervisorFlagged,
    timeExtensionMinutes: attempt.timeExtensionMinutes,
  };
}

export function myAttemptFor(paperId: string): DemoAttempt | undefined {
  return store.attempts.find(
    (a) => a.paperId === paperId && a.studentId === DEMO_ME.id,
  );
}

export function toExamSummary(paper: DemoPaper): ExamSummary {
  const mine = myAttemptFor(paper.paperId);
  const summary: ExamSummary = {
    id: paper.examId,
    title: paper.title,
    courseCode: paper.courseCode,
    context: paper.context,
    durationMinutes: paper.durationMinutes,
    questionCount: paper.questionCount,
    opensAt: null,
    closesAt: null,
    status: paper.status,
  };
  if (mine) summary.attemptId = mine.attemptId;
  return summary;
}

export function toAttemptState(attempt: DemoAttempt): AttemptState {
  const paper = paperOf(attempt);
  return {
    attemptId: attempt.attemptId,
    exam: {
      id: paper.examId,
      title: paper.title,
      courseCode: paper.courseCode,
      context: paper.context,
    },
    questions: buildQuestions(paper.examId, paper.questionCount),
    answers: attempt.answers,
    flagged: attempt.flagged,
    status: attempt.status,
    strikes: attempt.strikes,
    expiresAt: attempt.expiresAt,
    serverNow: iso(0),
    submittedAt: attempt.submittedAt,
  };
}

export function toPaperAssignment(paper: DemoPaper): PaperAssignment {
  const candidates = store.attempts.filter((a) => a.paperId === paper.paperId);
  return {
    paperId: paper.paperId,
    examId: paper.examId,
    title: paper.title,
    courseCode: paper.courseCode,
    departmentId: paper.departmentId,
    sessionLabel: paper.sessionLabel,
    startsAt: null,
    candidateCount: candidates.length,
    activeCount: candidates.filter((a) => a.status === "in-progress").length,
  };
}

export function securityLogRows(): SecurityLogRow[] {
  return store.attempts
    .flatMap((attempt) => {
      const paper = paperOf(attempt);
      const student = studentOf(attempt);
      return attempt.events.map((event) => ({
        id: event.id,
        occurredAt: event.occurredAt,
        attemptId: attempt.attemptId,
        studentName: student.fullName,
        matricNumber: student.matricNumber,
        courseCode: paper.courseCode,
        examTitle: paper.title,
        strike: event.strike,
        type: event.type,
        reason: event.reason,
        resultingStatus: event.strike >= 3 ? "paused" : "in-progress",
        departmentId: student.departmentId,
        examId: paper.examId,
      }));
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function resultRows(): ResultRow[] {
  return store.attempts
    .filter((a) => a.status === "submitted")
    .map((attempt) => {
      const paper = paperOf(attempt);
      const student = studentOf(attempt);
      const answered = answeredCount(attempt);
      return {
        attemptId: attempt.attemptId,
        studentId: student.id,
        fullName: student.fullName,
        matricNumber: student.matricNumber,
        departmentId: student.departmentId,
        courseCode: paper.courseCode,
        examTitle: paper.title,
        scorePercent: Math.round((answered / paper.questionCount) * 100),
        answered,
        total: paper.questionCount,
        submittedAt: attempt.submittedAt,
        status: "submitted",
      };
    });
}

export function registeredRows(): RegisteredStudentRow[] {
  return DEMO_STUDENTS.map((s) => ({
    studentId: s.id,
    fullName: s.fullName,
    matricNumber: s.matricNumber,
    departmentId: s.departmentId,
    programme: s.programme,
    level: s.level,
    photoUrl: s.photoUrl,
  }));
}

export type { DemoAttempt };

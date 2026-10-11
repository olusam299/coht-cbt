import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, FileText, Timer } from "lucide-react";
import { toast } from "sonner";
import type { ExamSummary } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { examService } from "@/services";
import { ContextBadge } from "./ContextBadge";

const statusCopy: Record<ExamSummary["status"], string> = {
  available: "Available now",
  scheduled: "Scheduled",
  closed: "Closed",
  completed: "Completed",
};

export function ExamCard({ exam }: { exam: ExamSummary }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const startable = exam.status === "available";

  async function handleStart() {
    // Guard is checked before setState so a rapid double-click cannot fire
    // two start requests. The button is also disabled while starting.
    if (!startable || starting) return;

    setStarting(true);
    setStartError(null);

    try {
      const attempt = await examService.startAttempt(exam.id);
      await navigate({
        to: "/exam/$attemptId",
        params: { attemptId: attempt.attemptId },
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "We could not start this examination. Please try again.";
      setStartError(message);
      toast.error(message);
      // The photo is required before a first paper: take the student to upload it.
      if (/identifier photo/i.test(message)) void navigate({ to: "/onboarding" });
    } finally {
      setStarting(false);
    }
  }

  return (
    <article className="surface-card flex flex-col gap-4 rounded-2xl p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-panel)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {exam.courseCode}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold">{exam.title}</h3>
        </div>
        <ContextBadge context={exam.context} />
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Timer className="size-4" aria-hidden /> {exam.durationMinutes} min
        </li>
        <li className="flex items-center gap-1.5">
          <FileText className="size-4" aria-hidden /> {exam.questionCount} questions
        </li>
        <li className="flex items-center gap-1.5">
          <CalendarClock className="size-4" aria-hidden /> {statusCopy[exam.status]}
        </li>
      </ul>

      {startable ? (
        <>
          <Button
            type="button"
            className="tap-target w-full rounded-xl font-semibold"
            onClick={handleStart}
            disabled={starting}
            aria-busy={starting}
          >
            {starting ? "Starting…" : "Start exam"}
          </Button>
          {startError ? (
            <p role="alert" className="text-sm text-destructive">
              {startError}
            </p>
          ) : null}
        </>
      ) : (
        <Button disabled variant="secondary" className="tap-target w-full rounded-xl">
          {statusCopy[exam.status]}
        </Button>
      )}
    </article>
  );
}

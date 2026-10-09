import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExamTopBar } from "@/components/exam/ExamTopBar";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { QuestionNavigator } from "@/components/exam/QuestionNavigator";
import { SubmitDialog } from "@/components/exam/SubmitDialog";
import { ContextBadge } from "@/components/exam/ContextBadge";
import { CalculatorDialog } from "@/components/exam/CalculatorDialog";
import { PausedOverlay, StrikeWarningDialog } from "@/components/exam/SecurityDialogs";
import { ErrorState, LoadingState } from "@/components/states";
import { useDevice } from "@/hooks/use-device";
import { useExamTimer } from "@/hooks/use-exam-timer";
import { useExamSecurity } from "@/hooks/use-exam-security";
import { authService, examService, profileService } from "@/services";
import type { AttemptResult, AttemptState } from "@/lib/exam-types";

export const Route = createFileRoute("/exam/$attemptId")({
  head: () => ({
    meta: [
      { title: "Exam Workspace | College of Health CBT Portal" },
      {
        name: "description",
        content:
          "Timed examination workspace with question navigator, progress tracking and secure submission.",
      },
      { property: "og:title", content: "Exam Workspace | College of Health CBT Portal" },
      {
        property: "og:description",
        content: "Sit your College of Health computer-based test in a focused, timed workspace.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamWorkspace,
});

function ExamWorkspace() {
  const { attemptId } = Route.useParams();
  const attempt = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => examService.getAttempt(attemptId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (attempt.isPending) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <LoadingState label="Preparing your exam" />
      </main>
    );
  }

  if (attempt.isError || !attempt.data) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="grid gap-4">
          <ErrorState
            title="This attempt couldn't be opened"
            description={
              attempt.error instanceof Error
                ? attempt.error.message
                : "The attempt may have expired or already been submitted."
            }
            onRetry={() => attempt.refetch()}
          />
          <Button asChild variant="ghost" className="tap-target justify-self-center">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <ExamSession
      // A new paper (Pharmacy PreNational switch) remounts the workspace with fresh answers.
      key={attempt.data.activePaperId ?? attempt.data.attemptId}
      attempt={attempt.data}
      onSwitchPaper={async (examCourseId) => {
        await examService.switchPaper({ attemptId, examCourseId });
        await attempt.refetch();
      }}
    />
  );
}

function ExamSession({
  attempt,
  onSwitchPaper,
}: {
  attempt: AttemptState;
  onSwitchPaper: (examCourseId: string) => Promise<void>;
}) {
  const { device, orientation, isPhone, isTablet, isTouch } = useDevice();
  const [index, setIndex] = useState(0);
  const [submission, setSubmission] = useState<AttemptResult | null>(null);
  const [answers, setAnswers] = useState(attempt.answers);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [flagged, setFlagged] = useState(attempt.flagged);
  const [navOpen, setNavOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const submittingRef = useRef(false);
  const serverPausedRef = useRef(attempt.status === "paused");

  const profile = useQuery({
    queryKey: ["profile", "exam-identity"],
    queryFn: () => profileService.getMyProfile(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Deadline, pauses and extensions come from the server clock, refreshed below.
  const [deadline, setDeadline] = useState({
    expiresAt: attempt.expiresAt,
    serverNow: attempt.serverNow,
  });
  const clock = useExamTimer(deadline.expiresAt, deadline.serverNow);
  const security = useExamSecurity({
    enabled: !attempt.submittedAt,
    initialStrikes: attempt.strikes ?? 0,
    initialPaused: attempt.status === "paused",
    onRecord: ({ type, reason, strike }) => {
      // Best-effort audit write; enforcement never waits on the network.
      void examService
        .recordSecurityEvent({ attemptId: attempt.attemptId, type, reason, strike })
        .catch(() => undefined);
    },
  });
  const questions = attempt.questions;
  const question = questions[index];
  const answered = useMemo(
    () => Object.values(answers).filter((value) => value.length > 0).length,
    [answers],
  );

  // Tablets in landscape and desktops have room for a persistent navigator.
  const showSideNavigator = device === "desktop" || (isTablet && orientation === "landscape");

  const go = useCallback(
    (next: number) => setIndex(Math.min(questions.length - 1, Math.max(0, next))),
    [questions.length],
  );

  const select = useCallback(
    (optionIds: string[]) => {
      if (!question) return;
      setAnswers((prev) => ({ ...prev, [question.id]: optionIds }));
      void examService
        .saveAnswer({ attemptId: attempt.attemptId, questionId: question.id, optionIds })
        .catch((err: unknown) =>
          setSaveError(err instanceof Error ? err.message : "Answer not saved."),
        );
    },
    [attempt.attemptId, question],
  );

  const toggleFlag = useCallback(() => {
    if (!question) return;
    const next = !flagged.includes(question.id);
    setFlagged((prev) =>
      next ? [...prev, question.id] : prev.filter((id) => id !== question.id),
    );
    void examService
      .setFlag({ attemptId: attempt.attemptId, questionId: question.id, flagged: next })
      .catch((err: unknown) => {
        // Roll back so the screen never shows a flag the server does not have.
        setFlagged((prev) =>
          next ? prev.filter((id) => id !== question.id) : [...prev, question.id],
        );
        setSaveError(err instanceof Error ? err.message : "Flag not saved.");
      });
  }, [attempt.attemptId, flagged, question]);

  const submit = useCallback(async () => {
    // A paused paper is held for a supervisor and must never be submitted.
    if (security.paused || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await examService.submitAttempt(attempt.attemptId);
      setConfirmOpen(false);
      setSubmission(result);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attempt.attemptId, security.paused]);

  const { pause: pauseExam, resume: resumeExam } = security;

  // Poll the server clock: applies supervisor pauses/resumes, time extensions and
  // forced submissions without a reload, and never trusts the device clock.
  useEffect(() => {
    if (submission) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const beat = await examService.heartbeat(attempt.attemptId);
        if (cancelled) return;
        setDeadline({ expiresAt: beat.expiresAt, serverNow: beat.serverNow });
        if (beat.status === "paused") {
          serverPausedRef.current = true;
          pauseExam();
        } else if (beat.status === "active" && serverPausedRef.current) {
          // Only a server-side pause that has now ended may lift the overlay.
          serverPausedRef.current = false;
          resumeExam();
        } else if (beat.status === "submitted") {
          // Submitted elsewhere (supervisor or server): show the confirmation and any allowed marks.
          const results = await examService.getResults(attempt.attemptId);
          if (cancelled) return;
          setSubmission({
            attemptId: attempt.attemptId,
            submittedAt: new Date().toISOString(),
            answered: Object.values(answersRef.current).filter((v) => v.length > 0).length,
            total: attempt.questions.length,
            allPapersSubmitted: true,
            ...(results.length ? { results } : {}),
          });
        }
      } catch {
        // Transient network error: keep the last known deadline and try again.
      }
    };
    const id = window.setInterval(() => void poll(), 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [attempt.attemptId, attempt.questions.length, submission, pauseExam, resumeExam]);

  // Time is up: submit what has been saved. Retries until the server accepts it.
  useEffect(() => {
    if (!clock.expired || submission || security.paused) return;
    void submit();
    const id = window.setInterval(() => void submit(), 8_000);
    return () => window.clearInterval(id);
  }, [clock.expired, submission, security.paused, submit]);

  const switchPaper = useCallback(
    async (examCourseId: string) => {
      setSwitching(true);
      setSaveError(null);
      try {
        await onSwitchPaper(examCourseId);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Could not switch paper.");
      } finally {
        setSwitching(false);
      }
    },
    [onSwitchPaper],
  );

  // Keyboard support for pointer-based devices.
  useEffect(() => {
    if (isTouch) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
      const numeric = Number(event.key);
      if (question && numeric >= 1 && numeric <= question.options.length) {
        select([question.options[numeric - 1]!.id]);
      }
      if (event.key.toLowerCase() === "f") toggleFlag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, isTouch, question, select, toggleFlag]);

  if (submission) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <section className="surface-card w-full max-w-lg rounded-3xl p-7 text-center sm:p-10">
          <div className="mx-auto grid size-24 place-items-center rounded-full border-2 border-primary border-r-transparent bg-primary/5">
            <Check className="size-11 text-primary motion-safe:animate-submit-tick" strokeWidth={2.8} aria-hidden />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Submission complete</p>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Your paper has been submitted</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Your answers have been received successfully. You may now leave the examination area.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground">Answered</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">{submission.answered}</p>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-xs text-muted-foreground">Questions</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">{submission.total}</p>
            </div>
          </div>
          {submission.results?.length ? (
            <div className="mt-6 grid gap-2 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your result</p>
              {submission.results.map((r) => (
                <div key={r.courseCode + r.courseTitle} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.courseCode}</p>
                    {r.courseTitle ? <p className="truncate text-xs text-muted-foreground">{r.courseTitle}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl font-bold tabular-nums">{r.percentage == null ? "—" : `${r.percentage.toFixed(r.percentage % 1 === 0 ? 0 : 1)}%`}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{r.correct} / {r.total} correct</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {submission.allPapersSubmitted === false ? (
            <>
              <p className="mt-5 text-sm text-muted-foreground">
                You have more papers to sit. Start the next one from your dashboard.
              </p>
              <Button asChild className="mt-4 tap-target w-full rounded-xl font-semibold">
                <Link to="/">Back to dashboard</Link>
              </Button>
            </>
          ) : (
            // The OTP is rotated once the whole sitting ends, so sign out on shared machines.
            <Button
              className="mt-7 tap-target w-full rounded-xl font-semibold"
              onClick={() => {
                void authService
                  .signOut()
                  .catch(() => undefined)
                  .finally(() => window.location.assign("/auth"));
              }}
            >
              Done
            </Button>
          )}
        </section>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <ErrorState title="No questions in this attempt" />
      </main>
    );
  }

  const navigator = (
    <QuestionNavigator
      questions={questions}
      currentIndex={index}
      answers={answers}
      flagged={flagged}
      onJump={(next) => {
        go(next);
        setNavOpen(false);
      }}
      columns={isPhone ? 5 : 6}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ExamTopBar
        title={attempt.exam.title}
        courseCode={attempt.exam.courseCode}
        context={attempt.exam.context}
        clock={clock}
        answered={answered}
        total={questions.length}
        compact={isPhone}
        onOpenNavigator={showSideNavigator ? undefined : () => setNavOpen(true)}
        onOpenCalculator={() => setCalcOpen(true)}
        onSubmit={() => setConfirmOpen(true)}
        submitting={submitting}
        strikes={security.strikes}
        maxStrikes={security.maxStrikes}
        paused={security.paused}
        studentName={profile.data?.fullName ?? "Student"}
        studentPhotoUrl={profile.data?.photoUrl ?? null}
        studentGender={profile.data?.gender ?? null}
      />

      {attempt.mode === "pharmacy-prenational" && (attempt.papers?.length ?? 0) > 1 ? (
        <nav aria-label="Papers in this sitting" className="border-b bg-card/60">
          <div className="mx-auto flex max-w-[110rem] gap-2 overflow-x-auto px-3 py-2 sm:px-6">
            {(attempt.papers ?? []).map((paper) => (
              <Button
                key={paper.id}
                size="sm"
                variant={paper.id === attempt.activePaperId ? "default" : "outline"}
                className="tap-target shrink-0 rounded-xl"
                disabled={
                  switching || submitting || security.paused || paper.status === "submitted"
                }
                aria-current={paper.id === attempt.activePaperId ? "true" : undefined}
                onClick={() => {
                  if (paper.id !== attempt.activePaperId) void switchPaper(paper.examCourseId);
                }}
              >
                {paper.courseCode}
                {paper.status === "submitted" ? " · done" : ""}
              </Button>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="mx-auto flex w-full max-w-[110rem] flex-1 gap-6 px-3 py-5 sm:px-6 lg:py-8">
        <main className="min-w-0 flex-1 pb-24 lg:pb-8">
          {saveError ? (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {saveError}
            </p>
          ) : null}

          <div className="surface-card rounded-2xl p-4 sm:p-6 lg:p-8">
            <QuestionCard
              question={question}
              total={questions.length}
              selected={answers[question.id] ?? []}
              flagged={flagged.includes(question.id)}
              onToggleFlag={toggleFlag}
              onSelect={select}
              compact={isPhone}
            />
          </div>

          {/* Desktop / tablet inline controls */}
          <div className="mt-6 hidden items-center justify-between gap-3 lg:flex">
            <Button
              variant="outline"
              className="tap-target rounded-xl"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            <p className="text-xs text-muted-foreground">
              Arrow keys to move · number keys to answer · F to flag
            </p>
            <Button
              className="tap-target rounded-xl"
              onClick={() => go(index + 1)}
              disabled={index === questions.length - 1}
            >
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </main>

        {showSideNavigator ? (
          <aside className="hidden w-72 shrink-0 md:block">
            <div className="surface-card sticky top-28 rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Questions</h2>
                <ContextBadge context={attempt.exam.context} />
              </div>
              {navigator}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Phone / tablet-portrait bottom control bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button
            variant="outline"
            className="tap-target flex-1 rounded-xl"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            <ChevronLeft className="size-4" aria-hidden /> Prev
          </Button>
          <Button
            variant="secondary"
            className="tap-target rounded-xl px-4 tabular-nums"
            onClick={() => setNavOpen(true)}
          >
            {index + 1}/{questions.length}
          </Button>
          <Button
            className="tap-target flex-1 rounded-xl"
            onClick={() => go(index + 1)}
            disabled={index === questions.length - 1}
          >
            Next <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Question navigator</SheetTitle>
          </SheetHeader>
          <div className="p-4">{navigator}</div>
        </SheetContent>
      </Sheet>

      <SubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        answered={answered}
        total={questions.length}
        flaggedCount={flagged.length}
        submitting={submitting}
        onConfirm={submit}
      />

      <CalculatorDialog open={calcOpen} onOpenChange={setCalcOpen} />

      <StrikeWarningDialog
        open={!!security.pending && !security.paused}
        strike={security.pending?.strike ?? 0}
        max={security.maxStrikes}
        reason={security.pending?.reason ?? ""}
        onAcknowledge={security.acknowledge}
      />

      <PausedOverlay
        open={security.paused}
        reason={security.pending?.reason ?? "Repeated integrity warnings"}
        strikes={security.strikes}
        max={security.maxStrikes}
      />
    </div>
  );
}
import { Calculator, Clock, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StudentAvatar } from "@/components/StudentAvatar";
import type { Gender } from "@/lib/student-profile";
import { ContextBadge } from "./ContextBadge";
import { StrikeIndicator } from "./StrikeIndicator";
import { NetworkStatus, type NetworkState } from "./NetworkStatus";
import type { ExamContext } from "@/lib/exam-types";
import type { ExamClock } from "@/hooks/use-exam-timer";
import { cn } from "@/lib/utils";

export interface ExamTopBarProps {
  /** Connection state and how many answers are waiting to reach the server. */
  network?: NetworkState;
  pendingAnswers?: number;
  title: string;
  courseCode: string;
  context: ExamContext;
  clock: ExamClock;
  answered: number;
  total: number;
  onOpenNavigator?: (() => void) | undefined;
  onOpenCalculator: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  compact?: boolean;
  strikes?: number;
  maxStrikes?: number;
  paused?: boolean;
  studentName?: string;
  studentPhotoUrl?: string | null;
  studentGender?: Gender | null;
}

export function ExamTopBar({
  title,
  courseCode,
  context,
  clock,
  network = "good",
  pendingAnswers = 0,
  answered,
  total,
  onOpenNavigator,
  onOpenCalculator,
  onSubmit,
  submitting,
  compact = false,
  strikes = 0,
  maxStrikes = 3,
  paused = false,
  studentName = "Student",
  studentPhotoUrl = null,
  studentGender = null,
}: ExamTopBarProps) {
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-[110rem] flex-col gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <StudentAvatar
              name={studentName}
              photoUrl={studentPhotoUrl}
              gender={studentGender}
              size={compact ? "sm" : "md"}
              ring
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {courseCode}
                </span>
                {!compact ? <ContextBadge context={context} /> : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NetworkStatus state={network} pending={pendingAnswers} compact={compact} />
            <div
              role="timer"
              aria-live="off"
              aria-label={`Time remaining ${clock.formatted}`}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-display text-base font-bold tabular-nums sm:text-lg",
                clock.critical
                  ? "bg-destructive/12 font-black text-destructive motion-safe:animate-timer-critical"
                  : clock.warning
                    ? "bg-warning/20 text-warning-foreground"
                    : "bg-secondary text-secondary-foreground",
              )}
            >
              <Clock className="size-4 shrink-0" aria-hidden />
              {clock.formatted}
            </div>
          </div>
        </div>

        {/*
          Single compact action row. The navigator control and the integrity
          indicator share the left cell (which can shrink and truncate) while
          Calculator + Submit stay pinned together on the right — so the
          indicator can never overlap or push Submit onto a second row.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {onOpenNavigator ? (
              <Button
                variant="outline"
                size="sm"
                className="tap-target shrink-0 gap-1.5 rounded-xl px-2.5"
                aria-label="Open question navigator"
                onClick={onOpenNavigator}
              >
                <LayoutGrid className="size-4 shrink-0" aria-hidden />
                <span className="hidden xs:inline">Questions</span>
              </Button>
            ) : null}
            <StrikeIndicator
              strikes={strikes}
              max={maxStrikes}
              paused={paused}
              compact={compact}
              className="min-w-0"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCalculator}
              aria-label="Open calculator"
              className="tap-target shrink-0 gap-1.5 rounded-xl px-2.5"
            >
              <Calculator className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Calculator</span>
            </Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={submitting || paused}
              className="tap-target shrink-0 rounded-xl px-3 font-semibold sm:px-4"
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Progress value={percent} className="h-1.5 flex-1" />
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {answered}/{total} answered
          </span>
        </div>
      </div>
    </header>
  );
}
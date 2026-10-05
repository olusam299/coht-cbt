import { AlertTriangle, Clock, Flag, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/StudentAvatar";
import { cn } from "@/lib/utils";
import {
  ATTEMPT_STATUS_LABELS,
  SUPERVISOR_ACTION_LABELS,
  formatRemaining,
  type MonitoredAttempt,
  type SupervisorAction,
} from "@/lib/exam-security";

export function MonitorStudentCard({
  attempt,
  actions,
  onAction,
  onAddTime,
  busy,
  avatarSize = "lg",
}: {
  attempt: MonitoredAttempt;
  actions: SupervisorAction[];
  onAction: (action: SupervisorAction) => void;
  /** SuperAdmin-only time extension entry point. */
  onAddTime?: () => void;
  busy?: boolean;
  /** SuperAdmin monitoring uses a slightly larger DP for recognition. */
  avatarSize?: "lg" | "xl";
}) {
  const needsAttention =
    attempt.status === "paused" || attempt.strikes > 0 || attempt.supervisorFlagged;
  const accentPalette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const accentIndex = Array.from(attempt.student.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % accentPalette.length;
  const accent = accentPalette[accentIndex]!;
  const accentStyle = { "--student-accent": accent } as CSSProperties;

  return (
    <article
      style={accentStyle}
      className={cn(
        "surface-card relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4",
        needsAttention && "outline outline-2 outline-warning/50",
        attempt.status === "paused" && "outline-destructive/60",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-[var(--student-accent)] opacity-70"
      />
      <div className="flex items-start gap-3 pl-1">
        <StudentAvatar
          name={attempt.student.fullName}
          photoUrl={attempt.student.photoUrl}
          gender={attempt.student.gender ?? null}
          size={avatarSize}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{attempt.student.fullName}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {attempt.student.matricNumber} · {attempt.courseCode}
          </p>
          <span
            className={cn(
              "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
              attempt.status === "paused"
                ? "bg-destructive/12 text-destructive"
                : attempt.status === "in-progress"
                  ? "bg-success/12 text-success"
                  : "bg-secondary text-secondary-foreground",
            )}
          >
            {ATTEMPT_STATUS_LABELS[attempt.status]}
          </span>
        </div>
        {attempt.supervisorFlagged ? (
          <Flag className="size-4 shrink-0 text-warning-foreground" aria-label="Flagged" />
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-secondary/60 py-2">
          <dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Progress</dt>
          <dd className="text-sm font-semibold tabular-nums">
            {attempt.answered} of {attempt.total}
          </dd>
        </div>
        <div className="rounded-xl bg-secondary/60 py-2">
          <dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Remaining</dt>
          <dd className="flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
            <Clock className="size-3.5" aria-hidden />
            {formatRemaining(attempt.expiresAt)}
          </dd>
        </div>
        <div className="rounded-xl bg-secondary/60 py-2">
          <dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Strikes</dt>
          <dd
            className={cn(
              "text-sm font-semibold tabular-nums",
              attempt.strikes > 0 && "text-destructive",
            )}
          >
            {attempt.strikes}/3
          </dd>
        </div>
      </dl>

      {attempt.lastEvent ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" aria-hidden />
          <span className="min-w-0">Last strike: {attempt.lastEvent.reason}</span>
        </p>
      ) : null}

      {attempt.timeExtensionMinutes ? (
        <p className="text-xs font-medium text-muted-foreground">Time extension: +{attempt.timeExtensionMinutes} min</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onAddTime ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onAddTime} className="tap-target rounded-xl text-xs">
            <Plus className="mr-1 size-3.5" aria-hidden /> Add time
          </Button>
        ) : null}
        {actions.map((action) => (
          <Button
            key={action}
            size="sm"
            variant={
              action === "cancel-paper"
                ? "destructive"
                : action === "resume"
                  ? "default"
                  : "outline"
            }
            disabled={busy}
            onClick={() => onAction(action)}
            className="tap-target rounded-xl text-xs"
          >
            {SUPERVISOR_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
    </article>
  );
}

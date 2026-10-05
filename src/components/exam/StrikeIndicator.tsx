import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StrikeIndicatorProps {
  strikes: number;
  max: number;
  paused?: boolean;
  /** Hide the wording and keep only pips on very narrow phones. */
  compact?: boolean;
  className?: string;
}

export function StrikeIndicator({
  strikes,
  max,
  paused = false,
  compact = false,
  className,
}: StrikeIndicatorProps) {
  const Icon = strikes > 0 ? ShieldAlert : ShieldCheck;
  const tone =
    paused || strikes >= max
      ? "bg-destructive/12 text-destructive"
      : strikes > 0
        ? "bg-warning/20 text-warning-foreground"
        : "bg-secondary text-muted-foreground";

  return (
    <div
      role="status"
      aria-label={`Security strikes ${strikes} of ${max}${paused ? ", paper paused" : ""}`}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {!compact ? (
        <span className="truncate">{paused ? "Paused" : "Integrity"}</span>
      ) : null}
      <span className="flex shrink-0 items-center gap-1" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full",
              i < strikes ? "bg-current" : "bg-current/25",
            )}
          />
        ))}
      </span>
    </div>
  );
}
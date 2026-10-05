import { EXAM_CONTEXT_LABELS, type ExamContext } from "@/lib/exam-types";
import { cn } from "@/lib/utils";

const styles: Record<ExamContext, string> = {
  regular: "bg-primary/10 text-primary ring-primary/20",
  "pharmacy-prenational": "bg-warning/15 text-warning-foreground ring-warning/30",
  continuous: "bg-success/12 text-success ring-success/25",
};

export function ContextBadge({
  context,
  className,
}: {
  context: ExamContext;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        styles[context],
        className,
      )}
    >
      {EXAM_CONTEXT_LABELS[context]}
    </span>
  );
}
import { Flag } from "lucide-react";
import type { Question } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuestionCardProps {
  question: Question;
  total: number;
  selected: string[];
  flagged: boolean;
  onToggleFlag: () => void;
  onSelect: (optionIds: string[]) => void;
  compact?: boolean;
}

export function QuestionCard({
  question,
  total,
  selected,
  flagged,
  onToggleFlag,
  onSelect,
  compact = false,
}: QuestionCardProps) {
  const multi = question.type === "multiple-choice";

  const toggle = (optionId: string) => {
    if (!multi) {
      onSelect([optionId]);
      return;
    }
    onSelect(
      selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId],
    );
  };

  return (
    <article className="animate-rise" aria-live="polite">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Question {question.index + 1} of {total}
            {multi ? " · select all that apply" : ""}
          </p>
          <h1
            className={cn(
              "mt-2 font-semibold leading-snug text-foreground",
              compact ? "text-lg" : "text-xl lg:text-2xl",
            )}
          >
            {question.text}
          </h1>
        </div>
        <Button
          type="button"
          variant={flagged ? "default" : "outline"}
          size="icon"
          aria-pressed={flagged}
          aria-label={flagged ? "Remove flag from question" : "Flag question for review"}
          onClick={onToggleFlag}
          className="tap-target shrink-0 rounded-full"
        >
          <Flag className="size-4" aria-hidden />
        </Button>
      </header>

      {question.imageUrl ? (
        <div className="mb-5 overflow-hidden rounded-xl border bg-muted">
          <img
            src={question.imageUrl}
            alt={`Illustration for question ${question.index + 1}`}
            className="w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : null}

      <div
        role={multi ? "group" : "radiogroup"}
        aria-label="Answer options"
        className="grid gap-3"
      >
        {question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={isSelected}
              onClick={() => toggle(option.id)}
              className={cn(
                "tap-target flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                isSelected
                  ? "border-primary bg-primary/8 shadow-[var(--shadow-soft)]"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg border text-sm font-semibold transition-colors",
                  isSelected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-secondary-foreground",
                )}
                aria-hidden
              >
                {option.label}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-relaxed sm:text-base">
                {option.text}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
import type { Question } from "@/lib/exam-types";
import { cn } from "@/lib/utils";

export interface QuestionNavigatorProps {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string[]>;
  flagged: string[];
  onJump: (index: number) => void;
  columns?: number;
}

export function QuestionNavigator({
  questions,
  currentIndex,
  answers,
  flagged,
  onJump,
  columns = 5,
}: QuestionNavigatorProps) {
  return (
    <nav aria-label="Question navigator" className="flex flex-col gap-4">
      <ul
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {questions.map((question, index) => {
          const answered = (answers[question.id]?.length ?? 0) > 0;
          const isFlagged = flagged.includes(question.id);
          const isCurrent = index === currentIndex;
          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onJump(index)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`Question ${index + 1}${answered ? ", answered" : ", unanswered"}${isFlagged ? ", flagged" : ""}`}
                className={cn(
                  "relative grid aspect-square w-full min-h-10 place-items-center rounded-lg border text-sm font-semibold transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : answered
                      ? "border-success/40 bg-success/12 text-success"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {index + 1}
                {isFlagged ? (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-warning"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden /> Current
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success/60" aria-hidden /> Answered
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-warning" aria-hidden /> Flagged
        </li>
      </ul>
    </nav>
  );
}
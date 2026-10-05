import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface SubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answered: number;
  total: number;
  flaggedCount: number;
  submitting: boolean;
  onConfirm: () => void;
}

export function SubmitDialog({
  open,
  onOpenChange,
  answered,
  total,
  flaggedCount,
  submitting,
  onConfirm,
}: SubmitDialogProps) {
  const unanswered = Math.max(0, total - answered);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
          <AlertDialogDescription>
            Once submitted you cannot return to this attempt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Answered", value: answered },
            { label: "Unanswered", value: unanswered },
            { label: "Flagged", value: flaggedCount },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-secondary p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="font-display text-xl font-bold tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel className="tap-target">Keep working</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            className="tap-target"
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
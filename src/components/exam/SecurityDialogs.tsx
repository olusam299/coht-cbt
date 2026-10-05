import { AlertTriangle, PauseCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface StrikeWarningDialogProps {
  open: boolean;
  strike: number;
  max: number;
  reason: string;
  onAcknowledge: () => void;
}

export function StrikeWarningDialog({
  open,
  strike,
  max,
  reason,
  onAcknowledge,
}: StrikeWarningDialogProps) {
  const remaining = Math.max(0, max - strike);
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0 text-warning-foreground" aria-hidden />
            Warning {strike} of {max}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reason}. This has been recorded on your exam audit trail.
            {remaining > 0
              ? ` ${remaining} more warning${remaining === 1 ? "" : "s"} will pause your paper.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="tap-target" onClick={onAcknowledge}>
            Continue exam
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface PausedOverlayProps {
  open: boolean;
  reason: string;
  strikes: number;
  max: number;
}

/** Strike limit reached: the paper is held. It is never auto-submitted. */
export function PausedOverlay({ open, reason, strikes, max }: PausedOverlayProps) {
  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Paper paused"
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 px-4 backdrop-blur"
    >
      <div className="surface-card w-full max-w-md rounded-2xl p-6 text-center">
        <PauseCircle className="mx-auto size-10 text-destructive" aria-hidden />
        <h2 className="mt-4 font-display text-xl font-bold">Your paper is paused</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {strikes} of {max} integrity warnings were recorded. Most recent: {reason}.
        </p>
        <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Your answers are safe and nothing has been submitted. Raise your hand — a
          supervisor must resume this paper for you.
        </p>
      </div>
    </div>
  );
}
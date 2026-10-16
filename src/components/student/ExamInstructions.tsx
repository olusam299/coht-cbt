import { AlertTriangle, Clock, MonitorSmartphone, ShieldAlert, Moon } from "lucide-react";

const POINTS = [
  {
    icon: Clock,
    text: "The countdown is controlled by the examination server. Closing or reloading the page does not stop it.",
  },
  {
    icon: MonitorSmartphone,
    text: "Stay on the exam screen. Leaving the window, switching tabs or answering a notification is recorded.",
  },
  {
    icon: ShieldAlert,
    text: "Strike 1 and strike 2 are warnings. Strike 3 pauses your paper — it is never submitted automatically. Only a supervisor can resume it.",
  },
  {
    icon: AlertTriangle,
    text: "Answers are saved as you go. Submit only when you are done; the confirmation screen shows what is still unanswered.",
  },
  {
    icon: Moon,
    text: "Prefer a darker screen? Use the Dark mode button at the top of the screen to switch the colour scheme, and tap it again to go back to light.",
  },
];

/** The approved pre-exam instructions notice shown on the student portal. */
export function ExamInstructions() {
  return (
    <section
      aria-labelledby="exam-instructions-heading"
      className="surface-card rounded-2xl border-l-4 border-l-warning p-5"
    >
      <h2 id="exam-instructions-heading" className="font-display text-base font-bold">
        Before you start
      </h2>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {POINTS.map((point) => (
          <li key={point.text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <point.icon className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
            <span className="min-w-0">{point.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
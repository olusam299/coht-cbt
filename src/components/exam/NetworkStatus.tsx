import { cn } from "@/lib/utils";

export type NetworkState = "good" | "offline" | "recovering";

const STYLE: Record<NetworkState, { ring: string; dot: string; text: string }> = {
  good: { ring: "bg-emerald-400", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  offline: { ring: "bg-red-400", dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  recovering: { ring: "bg-amber-400", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
};

function label(state: NetworkState, pending: number, compact: boolean) {
  if (state === "good") return compact ? "Online" : pending ? `Online · saving ${pending}` : "Online · answers saved";
  if (state === "offline") return compact ? "Offline" : pending ? `Offline · ${pending} saved on this device` : "Offline · answers kept on this device";
  return compact ? "Syncing" : pending ? `Reconnected · syncing ${pending}` : "Reconnected · syncing";
}

/** A blinking dot: green when answers are syncing normally, red when offline, amber while catching up after an outage. */
export function NetworkStatus({
  state,
  pending = 0,
  compact = false,
  className,
}: {
  state: NetworkState;
  pending?: number;
  compact?: boolean;
  className?: string;
}) {
  const s = STYLE[state];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-xs font-medium", s.text, className)}
    >
      <span className="relative flex size-2.5 shrink-0" aria-hidden>
        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping", s.ring)} />
        <span className={cn("relative inline-flex size-2.5 rounded-full", s.dot)} />
      </span>
      <span className="truncate">{label(state, pending, compact)}</span>
    </div>
  );
}

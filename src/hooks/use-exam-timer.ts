import { useEffect, useMemo, useRef, useState } from "react";

export interface ExamClock {
  remainingMs: number;
  formatted: string;
  expired: boolean;
  /** true when under 5 minutes remain */
  critical: boolean;
  /** true when under 15 minutes remain */
  warning: boolean;
}

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Ticks against the server-authoritative deadline. `serverNow` anchors the
 * offset so a wrong device clock cannot extend or shorten an exam.
 */
export function useExamTimer(
  expiresAt: string | null | undefined,
  serverNow: string | null | undefined,
): ExamClock {
  const offsetRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (serverNow) offsetRef.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return useMemo(() => {
    if (!expiresAt) {
      return {
        remainingMs: 0,
        formatted: "--:--",
        expired: false,
        critical: false,
        warning: false,
      };
    }
    const remainingMs = Math.max(
      0,
      new Date(expiresAt).getTime() - (Date.now() + offsetRef.current),
    );
    return {
      remainingMs,
      formatted: format(remainingMs),
      expired: remainingMs <= 0,
      critical: remainingMs > 0 && remainingMs <= 5 * 60_000,
      warning: remainingMs > 0 && remainingMs <= 15 * 60_000,
    };
  }, [expiresAt, tick]);
}
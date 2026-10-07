import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_STRIKES,
  SECURITY_EVENT_LABELS,
  type SecurityEventType,
} from "@/lib/exam-security";

export interface StrikeState {
  strikes: number;
  paused: boolean;
  /** The most recent strike that has not been acknowledged by the candidate. */
  pending: { strike: number; type: SecurityEventType; reason: string } | null;
}

export interface UseExamSecurityOptions {
  /** Disable detection (e.g. while the attempt is already submitted). */
  enabled: boolean;
  initialStrikes?: number;
  initialPaused?: boolean;
  /** Best-effort audit recording; enforcement never waits on it. */
  onRecord?: (input: { type: SecurityEventType; reason: string; strike: number }) => void;
}

/** Debounce so one tab switch cannot register blur + visibility as two strikes. */
const COOLDOWN_MS = 1200;

export function useExamSecurity({
  enabled,
  initialStrikes = 0,
  initialPaused = false,
  onRecord,
}: UseExamSecurityOptions) {
  const [state, setState] = useState<StrikeState>({
    strikes: initialStrikes,
    paused: initialPaused,
    pending: null,
  });
  const lastAtRef = useRef(0);
  const recordRef = useRef(onRecord);
  recordRef.current = onRecord;

  const register = useCallback((type: SecurityEventType) => {
    const now = Date.now();
    if (now - lastAtRef.current < COOLDOWN_MS) return;
    lastAtRef.current = now;

    setState((prev) => {
      if (prev.paused) return prev;
      const strike = Math.min(MAX_STRIKES, prev.strikes + 1);
      const reason = SECURITY_EVENT_LABELS[type];
      recordRef.current?.({ type, reason, strike });
      return {
        strikes: strike,
        // Strike 3 pauses the paper. It must never submit it.
        paused: strike >= MAX_STRIKES,
        pending: { strike, type, reason },
      };
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onBlur = () => register("window-blur");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") register("tab-hidden");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, register]);

  const acknowledge = useCallback(
    () => setState((prev) => ({ ...prev, pending: null })),
    [],
  );

  /** Applied when the server reports the session as paused (supervisor action). */
  const pause = useCallback(
    () => setState((prev) => (prev.paused ? prev : { ...prev, paused: true, pending: null })),
    [],
  );

  /** Applied when a supervisor resumes the paper. */
  const resume = useCallback(
    () => setState((prev) => ({ ...prev, paused: false, pending: null })),
    [],
  );

  return {
    strikes: state.strikes,
    paused: state.paused,
    pending: state.pending,
    maxStrikes: MAX_STRIKES,
    register,
    acknowledge,
    resume,
    pause,
  };
}
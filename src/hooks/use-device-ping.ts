import { useEffect } from "react";
import { toast } from "sonner";
import { DeviceConflictError } from "@/lib/device";
import { authService, examService } from "@/services";

/**
 * While a student is signed in, tells the server this browser is still the
 * active device. If another device took over, this one is signed out.
 */
export function useDevicePing(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const ping = async () => {
      try {
        await examService.pingDevice();
      } catch (error) {
        if (stopped || !(error instanceof DeviceConflictError)) return;
        toast.error(error.message, { duration: 12000 });
        await authService.signOut().catch(() => undefined);
        window.location.assign("/auth");
      }
    };

    void ping();
    const id = window.setInterval(() => void ping(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}

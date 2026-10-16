import { createFileRoute } from "@tanstack/react-router";
import { RoleShell } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { StudentOtpPanel } from "@/components/superadmin/StudentOtpPanel";

export const Route = createFileRoute("/superadmin/otp")({ component: OtpDesk });

function OtpDesk() {
  return (
    <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="OTP Desk" subtitle="Issue and print student OTPs">
      <StudentOtpPanel />
    </RoleShell>
  );
}

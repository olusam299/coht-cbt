import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { ALL_DEPARTMENTS, DepartmentFilter } from "@/components/admin/DepartmentFilter";
import { ServiceState } from "@/components/ServiceState";
import { supervisionService } from "@/services";
import { SECURITY_EVENT_LABELS } from "@/lib/exam-security";

export const Route = createFileRoute("/superadmin/security")({
  head: () => ({
    meta: [
      { title: "Security & Strike Logs | COHT CBT SuperAdmin" },
      {
        name: "description",
        content:
          "Audit trail of every integrity strike: time, candidate, paper, strike number and recorded reason.",
      },
      { property: "og:title", content: "Security & Strike Logs | COHT CBT SuperAdmin" },
      { property: "og:description", content: "Integrity strike audit trail for CBT sittings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminSecurity,
});

function SuperAdminSecurity() {
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const events = useQuery({
    queryKey: ["security-logs", department],
    queryFn: () =>
      supervisionService.listSecurityEvents(
        department === ALL_DEPARTMENTS ? {} : { departmentId: department },
      ),
    retry: false,
  });

  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="Security logs"
      subtitle="Strike 3 pauses the paper — it is never submitted automatically"
    >
      <SectionHeader
        title="Strike audit trail"
        actions={<DepartmentFilter value={department} onChange={setDepartment} />}
      />
      <ServiceState
        query={events}
        skeleton="inline"
        emptyTitle="No integrity events recorded"
        emptyDescription="Every blur, tab switch or visibility change during a sitting is logged here."
      >
        {(rows) => (
          <ul className="grid gap-3">
            {rows.map((row) => (
              <li key={row.id} className="surface-card grid gap-1 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {row.studentName}{" "}
                    <span className="font-normal text-muted-foreground">{row.matricNumber}</span>
                  </p>
                  <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-semibold text-destructive">
                    Strike {row.strike}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.occurredAt).toLocaleString()} · {row.courseCode} · {row.examTitle}
                </p>
                <p className="text-sm">
                  {SECURITY_EVENT_LABELS[row.type]} — {row.reason}
                </p>
                <p className="text-xs text-muted-foreground">Resulting status: {row.resultingStatus}</p>
              </li>
            ))}
          </ul>
        )}
      </ServiceState>
    </RoleShell>
  );
}

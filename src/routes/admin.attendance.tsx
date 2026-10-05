import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RoleShell, SectionHeader, StatTile } from "@/components/layout/RoleShell";
import { ADMIN_NAV } from "@/components/layout/nav-config";
import { PaperPicker } from "@/components/admin/PaperPicker";
import { StudentAvatar } from "@/components/StudentAvatar";
import { ServiceState } from "@/components/ServiceState";
import { EmptyState } from "@/components/states";
import { adminService } from "@/services";
import { ATTEMPT_STATUS_LABELS } from "@/lib/exam-security";

export const Route = createFileRoute("/admin/attendance")({
  validateSearch: (search: Record<string, unknown>) => ({
    paper: typeof search['paper'] === "string" ? (search['paper'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Attendance Roll | COHT CBT Admin" },
      {
        name: "description",
        content:
          "Clear candidates into an assigned paper and record their answering-start attendance details.",
      },
      { property: "og:title", content: "Attendance Roll | COHT CBT Admin" },
      {
        property: "og:description",
        content: "Record attendance and clear candidates into their CBT sitting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAttendance,
});

function AdminAttendance() {
  const { paper } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/attendance" });
  const [busy, setBusy] = useState<string | null>(null);

  const papers = useQuery({
    queryKey: ["admin", "papers"],
    queryFn: () => adminService.listAssignedPapers(),
    retry: false,
  });
  const selected = paper ?? papers.data?.[0]?.paperId;

  const roll = useQuery({
    queryKey: ["admin", "candidates", selected],
    queryFn: () => adminService.listCandidates(selected as string),
    enabled: Boolean(selected),
    retry: false,
  });

  const rows = roll.data ?? [];
  const cleared = rows.filter((row) => Boolean(row.startedAt)).length;

  async function clearIn(studentId: string) {
    if (!selected) return;
    setBusy(studentId);
    try {
      await adminService.clearStudentIntoPaper({ paperId: selected, studentId });
      await roll.refetch();
      toast.success("Candidate cleared into the paper");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear candidate");
    } finally {
      setBusy(null);
    }
  }

  return (
    <RoleShell
      role="admin"
      items={ADMIN_NAV}
      title="Attendance"
      subtitle="Clearing a candidate records their answering-start details"
    >
      <SectionHeader
        title="Roll for the selected paper"
        actions={
          <PaperPicker
            papers={papers.data ?? []}
            value={selected}
            onChange={(paperId) => navigate({ search: { paper: paperId } })}
          />
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="On the roll" value={String(rows.length)} />
        <StatTile label="Cleared in" value={String(cleared)} tone="success" />
        <StatTile label="Awaiting clearance" value={String(Math.max(0, rows.length - cleared))} />
      </div>

      {!selected ? (
        <ServiceState
          query={papers}
          emptyTitle="No papers assigned"
          emptyDescription="Attendance opens once you are assigned to a paper."
        >
          {() => <EmptyState title="Select a paper" description="Choose an assigned paper to take the roll." />}
        </ServiceState>
      ) : (
        <ServiceState
          query={roll}
          skeleton="inline"
          emptyTitle="No candidates registered"
          emptyDescription="Registered candidates for this sitting will be listed here."
        >
          {() => (
            <ul className="grid gap-3">
              {rows.map((row) => (
                <li
                  key={row.attemptId}
                  className="surface-card flex flex-wrap items-center gap-3 rounded-2xl p-4"
                >
                  <StudentAvatar
                    name={row.student.fullName}
                    photoUrl={row.student.photoUrl}
                    gender={row.student.gender ?? null}
                    size="lg"
                  />
                  <div className="min-w-[10rem] flex-1">
                    <p className="truncate text-sm font-semibold">{row.student.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.student.matricNumber} · {ATTEMPT_STATUS_LABELS[row.status]}
                    </p>
                  </div>
                  {row.startedAt ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                      <CheckCircle2 className="size-4" aria-hidden />
                      Started {new Date(row.startedAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="tap-target rounded-xl"
                      disabled={busy === row.student.id}
                      onClick={() => clearIn(row.student.id)}
                    >
                      <UserCheck className="size-4" aria-hidden /> Clear in
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ServiceState>
      )}
    </RoleShell>
  );
}

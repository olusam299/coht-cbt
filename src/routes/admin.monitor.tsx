import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { ADMIN_NAV } from "@/components/layout/nav-config";
import { PaperPicker } from "@/components/admin/PaperPicker";
import { MonitorStudentCard } from "@/components/admin/MonitorStudentCard";
import { ServiceState } from "@/components/ServiceState";
import { EmptyState } from "@/components/states";
import { adminService } from "@/services";
import { sortByAttention, type SupervisorAction } from "@/lib/exam-security";

export const Route = createFileRoute("/admin/monitor")({
  validateSearch: (search: Record<string, unknown>) => ({
    paper: typeof search['paper'] === "string" ? (search['paper'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live Paper Monitoring | COHT CBT Admin" },
      {
        name: "description",
        content:
          "Watch candidates writing your assigned paper in real time: progress, integrity strikes and pause or resume controls.",
      },
      { property: "og:title", content: "Live Paper Monitoring | COHT CBT Admin" },
      {
        property: "og:description",
        content: "Real-time candidate supervision for assigned CBT papers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMonitor,
});

const ADMIN_ACTIONS: SupervisorAction[] = ["pause", "resume"];

function AdminMonitor() {
  const { paper } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/monitor" });
  const [busy, setBusy] = useState<string | null>(null);

  const papers = useQuery({
    queryKey: ["admin", "papers"],
    queryFn: () => adminService.listAssignedPapers(),
    retry: false,
  });

  const selected = paper ?? papers.data?.[0]?.paperId;

  const candidates = useQuery({
    queryKey: ["admin", "candidates", selected],
    queryFn: () => adminService.listCandidates(selected as string),
    enabled: Boolean(selected),
    retry: false,
  });

  const ordered = useMemo(() => sortByAttention(candidates.data ?? []), [candidates.data]);

  async function handleAction(attemptId: string, action: SupervisorAction) {
    if (action !== "pause" && action !== "resume") return;
    setBusy(attemptId);
    try {
      await adminService.applyAction({ attemptId, action });
      await candidates.refetch();
      toast.success("Action applied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function flag(attemptId: string) {
    setBusy(attemptId);
    try {
      await adminService.flagForSupervisor({ attemptId, reason: "Admin requested review" });
      await candidates.refetch();
      toast.success("Supervisor notified");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not flag candidate");
    } finally {
      setBusy(null);
    }
  }

  return (
    <RoleShell
      role="admin"
      items={ADMIN_NAV}
      title="Live paper"
      subtitle="Candidates needing attention are listed first"
    >
      <SectionHeader
        title="Assigned paper"
        description="Monitoring is scoped to the sittings assigned to you. Results are never shown here."
        actions={
          <PaperPicker
            papers={papers.data ?? []}
            value={selected}
            onChange={(paperId) => navigate({ search: { paper: paperId } })}
          />
        }
      />

      {papers.isError || !selected ? (
        <ServiceState
          query={papers}
          emptyTitle="No papers assigned"
          emptyDescription="You will see live candidates once a paper and session are assigned to you."
        >
          {() => (
            <EmptyState
              title="Select a paper"
              description="Choose one of your assigned papers to begin monitoring."
            />
          )}
        </ServiceState>
      ) : (
        <ServiceState
          query={candidates}
          emptyTitle="No candidates writing yet"
          emptyDescription="Cleared candidates appear here the moment they begin answering."
        >
          {() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {ordered.map((attempt) => (
                <div key={attempt.attemptId} className="grid gap-2">
                  <MonitorStudentCard
                    attempt={attempt}
                    actions={ADMIN_ACTIONS}
                    busy={busy === attempt.attemptId}
                    onAction={(action) => handleAction(attempt.attemptId, action)}
                  />
                  <button
                    type="button"
                    disabled={busy === attempt.attemptId}
                    onClick={() => flag(attempt.attemptId)}
                    className="tap-target rounded-xl border border-dashed text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Flag for supervisor
                  </button>
                </div>
              ))}
            </div>
          )}
        </ServiceState>
      )}
    </RoleShell>
  );
}

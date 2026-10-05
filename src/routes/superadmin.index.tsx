import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MonitorPlay, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleShell, SectionHeader, StatTile } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { ServiceState } from "@/components/ServiceState";
import { supervisionService } from "@/services";
import { sortByAttention } from "@/lib/exam-security";
import { MonitorStudentCard } from "@/components/admin/MonitorStudentCard";

export const Route = createFileRoute("/superadmin/")({
  head: () => ({
    meta: [
      { title: "SuperAdmin Console | College of Health CBT Portal" },
      {
        name: "description",
        content:
          "Institution-wide oversight of live CBT papers, candidates, integrity strikes, results and administrators.",
      },
      { property: "og:title", content: "SuperAdmin Console | College of Health CBT Portal" },
      {
        property: "og:description",
        content: "Institution-wide oversight of the College of Health CBT examinations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminDashboard,
});

function SuperAdminDashboard() {
  const attempts = useQuery({
    queryKey: ["supervision", "active"],
    queryFn: () => supervisionService.listActiveAttempts(),
    retry: false,
  });

  const list = attempts.data ?? [];
  const paused = list.filter((a) => a.status === "paused").length;
  const struck = list.filter((a) => a.strikes > 0).length;
  const priority = sortByAttention(list).slice(0, 6);

  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="Institution overview"
      subtitle="Every paper, candidate and integrity event"
      actions={
        <Button asChild variant="outline" className="tap-target rounded-xl">
          <Link to="/superadmin/monitor">
            <MonitorPlay className="size-4" aria-hidden />
            <span className="hidden sm:inline">Monitor</span>
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live candidates" value={String(list.length)} tone="success" />
        <StatTile label="Paused papers" value={String(paused)} tone="danger" hint="Never auto-submitted" />
        <StatTile label="With strikes" value={String(struck)} tone="warning" />
        <StatTile label="Flagged by admins" value={String(list.filter((a) => a.supervisorFlagged).length)} />
      </div>

      <section className="mt-8">
        <SectionHeader
          title="Needs attention"
          description="Paused papers, supervisor flags and strike activity float to the top."
          actions={
            <Button asChild variant="outline" size="sm" className="tap-target rounded-xl">
              <Link to="/superadmin/security">
                <ShieldAlert className="size-4" aria-hidden /> Security logs
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        />
        <ServiceState
          query={attempts}
          emptyTitle="No live papers right now"
          emptyDescription="Active sittings across the institution will appear here."
        >
          {() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {priority.map((attempt) => (
                <MonitorStudentCard
                  key={attempt.attemptId}
                  attempt={attempt}
                  avatarSize="xl"
                  actions={[]}
                  onAction={() => undefined}
                />
              ))}
            </div>
          )}
        </ServiceState>
      </section>
    </RoleShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleShell, SectionHeader, StatTile } from "@/components/layout/RoleShell";
import { ADMIN_NAV } from "@/components/layout/nav-config";
import { ServiceState } from "@/components/ServiceState";
import { adminService } from "@/services";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console | College of Health CBT Portal" },
      {
        name: "description",
        content:
          "Supervise your assigned computer-based papers: attendance, live candidate progress and integrity strikes.",
      },
      { property: "og:title", content: "Admin Console | College of Health CBT Portal" },
      {
        property: "og:description",
        content: "Operational supervision console for assigned CBT papers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const papers = useQuery({
    queryKey: ["admin", "papers"],
    queryFn: () => adminService.listAssignedPapers(),
    retry: false,
  });

  const list = papers.data ?? [];
  const candidates = list.reduce((n, p) => n + p.candidateCount, 0);
  const active = list.reduce((n, p) => n + p.activeCount, 0);

  return (
    <RoleShell
      role="admin"
      items={ADMIN_NAV}
      title="Supervision dashboard"
      subtitle="Only the papers assigned to you"
      actions={
        <Button asChild variant="outline" className="tap-target rounded-xl">
          <Link to="/admin/monitor" search={{ paper: undefined }}>
            <MonitorPlay className="size-4" aria-hidden />
            <span className="hidden sm:inline">Live paper</span>
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Assigned papers" value={String(list.length)} hint="Sittings you supervise" />
        <StatTile label="Candidates" value={String(candidates)} hint="Registered on your papers" />
        <StatTile label="Currently writing" value={String(active)} tone="success" />
      </div>

      <section className="mt-8">
        <SectionHeader
          title="Assigned papers"
          description="Select a paper to monitor its candidates or take the attendance roll."
        />
        <ServiceState
          query={papers}
          emptyTitle="No papers assigned yet"
          emptyDescription="A SuperAdmin assigns you to a paper and session before it appears here."
        >
          {(rows) => (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((paper) => (
                <article key={paper.paperId} className="surface-card grid gap-3 rounded-2xl p-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {paper.courseCode}
                    </p>
                    <h3 className="mt-1 truncate font-display text-base font-bold">{paper.title}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {paper.sessionLabel}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-secondary/60 py-2">
                      <dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                        Candidates
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">{paper.candidateCount}</dd>
                    </div>
                    <div className="rounded-xl bg-secondary/60 py-2">
                      <dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                        Writing
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">{paper.activeCount}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="tap-target rounded-xl">
                      <Link to="/admin/monitor" search={{ paper: paper.paperId }}>
                        Monitor <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="tap-target rounded-xl">
                      <Link to="/admin/attendance" search={{ paper: paper.paperId }}>
                        <ClipboardList className="size-4" aria-hidden /> Attendance
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ServiceState>
      </section>
    </RoleShell>
  );
}

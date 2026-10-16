import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { ALL_DEPARTMENTS, DepartmentFilter } from "@/components/admin/DepartmentFilter";
import { ServiceState } from "@/components/ServiceState";
import { resultsService } from "@/services";
import type { ExportFormat } from "@/lib/departments";
import { deliverExport } from "@/lib/export-file";

export const Route = createFileRoute("/superadmin/results")({
  head: () => ({
    meta: [
      { title: "Results & Reports | COHT CBT SuperAdmin" },
      {
        name: "description",
        content:
          "Department-aware CBT results with Excel and PDF export. Results are visible to SuperAdmins only.",
      },
      { property: "og:title", content: "Results & Reports | COHT CBT SuperAdmin" },
      { property: "og:description", content: "Department-aware CBT results and exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminResults,
});

function SuperAdminResults() {
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const [showArchived, setShowArchived] = useState(false);
  const scope = {
    ...(department === ALL_DEPARTMENTS ? {} : { departmentId: department }),
    ...(showArchived ? { includeArchived: true } : {}),
  };

  const results = useQuery({
    queryKey: ["results", department, showArchived],
    queryFn: () => resultsService.listResults(scope),
    retry: false,
  });

  async function exportResults(format: ExportFormat) {
    try {
      deliverExport(await resultsService.exportResults({ ...scope, format }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  }

  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="Results & reports"
      subtitle="SuperAdmin only — admins never see results"
    >
      <SectionHeader
        title="Results"
        actions={
          <>
            <DepartmentFilter value={department} onChange={setDepartment} />
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm">Show archived</Label>
            </div>
            <Button variant="outline" className="tap-target rounded-xl" onClick={() => exportResults("csv")}>
              <Download className="size-4" aria-hidden /> CSV (Excel)
            </Button>
            <Button variant="outline" className="tap-target rounded-xl" onClick={() => exportResults("pdf")}>
              <Download className="size-4" aria-hidden /> Print / PDF
            </Button>
          </>
        }
      />
      <ServiceState
        query={results}
        skeleton="inline"
        emptyTitle="No results yet"
        emptyDescription="Scored submissions will be listed here per department and paper."
      >
        {(rows) => (
          <div className="surface-card overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Matric</th>
                  <th className="p-3">Paper</th>
                  <th className="p-3">Answered</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.attemptId} className="border-b last:border-0">
                    <td className="p-3 font-medium">{row.fullName}</td>
                    <td className="p-3 tabular-nums">{row.matricNumber}</td>
                    <td className="p-3">{row.courseCode}</td>
                    <td className="p-3 tabular-nums">{row.answered}/{row.total}</td>
                    <td className="p-3 tabular-nums">{row.scorePercent ?? "—"}</td>
                    <td className="p-3">{row.status}{row.archived ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Archived</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ServiceState>
    </RoleShell>
  );
}

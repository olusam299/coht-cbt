import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { ALL_DEPARTMENTS, DepartmentFilter } from "@/components/admin/DepartmentFilter";
import { StudentAvatar } from "@/components/StudentAvatar";
import { ServiceState } from "@/components/ServiceState";
import { resultsService } from "@/services";
import { type ExportFormat } from "@/lib/departments";
import { deliverExport } from "@/lib/export-file";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/superadmin/students")({
  head: () => ({ meta: [{ title: "Registered Students | COHT CBT SuperAdmin" }] }),
  component: SuperAdminStudents,
});

function SuperAdminStudents() {
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const [term, setTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const departments = useQuery({
    queryKey: ["departments", "students-page"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("superadmin_list_departments");
      if (error) throw new Error(error.message);
      return data ?? [];
    }, staleTime: 5 * 60 * 1000, retry: false,
  });
  const departmentNames = useMemo(() => new Map<string, string>((departments.data ?? []).map((d: { id: string; name: string }) => [d.id, d.name] as [string, string])), [departments.data]);
  const students = useQuery({
    queryKey: ["students", department],
    queryFn: () => resultsService.listRegisteredStudents(department === ALL_DEPARTMENTS ? {} : { departmentId: department }),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["student-detail", selectedStudentId],
    queryFn: () => resultsService.getStudentDetail(selectedStudentId!),
    enabled: Boolean(selectedStudentId), retry: false,
  });
  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase(); const list = students.data ?? [];
    if (!needle) return list;
    return list.filter((s) => s.fullName.toLowerCase().includes(needle) || s.matricNumber.toLowerCase().includes(needle));
  }, [students.data, term]);
  async function exportRegister(format: ExportFormat) {
    try { deliverExport(await resultsService.exportRegister({ ...(department === ALL_DEPARTMENTS ? {} : { departmentId: department }), format })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Export failed"); }
  }
  return <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="Students" subtitle="Registered candidates by department">
    <SectionHeader title="Register" actions={<>
      <DepartmentFilter value={department} onChange={setDepartment} />
      <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search name or matric" aria-label="Search students" className="tap-target w-full rounded-xl sm:w-60" />
      <Button variant="outline" className="tap-target rounded-xl" onClick={() => exportRegister("csv")}><Download className="size-4" aria-hidden /> CSV (Excel)</Button>
      <Button variant="outline" className="tap-target rounded-xl" onClick={() => exportRegister("pdf")}><Download className="size-4" aria-hidden /> Print / PDF</Button>
    </>} />
    <ServiceState query={students} emptyTitle="No registered students" emptyDescription="Candidates appear here once the registry is connected.">
      {() => <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((student) =>
        <button key={student.studentId} type="button" onClick={() => setSelectedStudentId(student.studentId)} className="surface-card group flex items-center gap-3 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
          <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} gender={null} size="lg" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{student.fullName}</p><p className="truncate text-xs text-muted-foreground">{student.matricNumber}</p><p className="truncate text-xs text-muted-foreground">{departmentNames.get(student.departmentId ?? "") ?? "Unassigned"}{student.level ? ` · ${String(student.level)}` : ""}</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">View complete record <ChevronRight className="size-3.5" /></p></div>
        </button>)}{!rows.length && !students.isPending ? <p className="col-span-full rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No student matches the current search.</p> : null}</div>}
    </ServiceState>
    <Dialog open={Boolean(selectedStudentId)} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Complete student record</DialogTitle></DialogHeader>
        {detail.isPending ? <p className="py-8 text-sm text-muted-foreground">Loading student record…</p> : detail.isError ? <p className="py-8 text-sm text-destructive">{detail.error instanceof Error ? detail.error.message : "Unable to load student record."}</p> : detail.data ? <div className="grid gap-5">
          <section className="rounded-2xl border p-4"><div className="flex items-start gap-4"><StudentAvatar name={detail.data.fullName} photoUrl={null} gender={null} size="xl" /><div className="min-w-0"><h3 className="text-lg font-bold">{detail.data.fullName}</h3><p className="text-sm text-muted-foreground">{detail.data.matricNumber}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-secondary px-3 py-1">{detail.data.departmentCode ?? "—"} · {detail.data.departmentName ?? "Unassigned"}</span><span className="rounded-full bg-secondary px-3 py-1">{detail.data.programmeCode ?? "—"} · {detail.data.programmeName ?? "Unassigned"}</span><span className="rounded-full bg-secondary px-3 py-1">Level {detail.data.level ?? "—"}</span><span className="rounded-full bg-secondary px-3 py-1">{detail.data.isActive ? "Active" : "Inactive"}</span></div></div></div></section>
          <section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Registered courses</h3><p className="text-xs text-muted-foreground">Every registration recorded for this student, including resits/carryovers.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{detail.data.registrations.length} total</span></div>
            {detail.data.registrations.length ? <div className="overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead className="bg-secondary/50 text-left text-xs"><tr><th className="p-3">Course</th><th className="p-3">Session</th><th className="p-3">Type</th><th className="p-3">Status</th></tr></thead><tbody>{detail.data.registrations.map((r) => <tr key={r.registration_id} className="border-t"><td className="p-3"><b>{r.course_code}</b><div className="text-xs text-muted-foreground">{r.course_title} · {r.credit_units ?? "—"} CU</div></td><td className="p-3">{r.academic_session_name ?? "—"}</td><td className="p-3">{r.registration_type ?? "—"}</td><td className="p-3">{r.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No course registrations are recorded for this student.</div>}
          </section>
        </div> : null}
      </DialogContent>
    </Dialog>
  </RoleShell>;
}

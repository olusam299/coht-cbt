import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus, UserCheck, UserMinus } from "lucide-react";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { ServiceState } from "@/components/ServiceState";
import { examManagementService } from "@/services/exam-management";
import { systemService } from "@/services";
import { EXAM_CONTEXT_LABELS, type ExamContext } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/superadmin/papers")({
  head: () => ({ meta: [{ title: "Examinations & Papers | COHT CBT SuperAdmin" }] }),
  component: SuperAdminPapers,
});

function SuperAdminPapers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ExamContext>("regular");
  const [duration, setDuration] = useState("60");
  const [questionCount, setQuestionCount] = useState("0");
  const [sessionId, setSessionId] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [active, setActive] = useState(false);
  const exams = useQuery({ queryKey: ["superadmin-papers"], queryFn: () => examManagementService.list(), retry: false });
  const admins = useQuery({ queryKey: ["system", "admins"], queryFn: () => systemService.listAdmins(), retry: false });
  const assignments = useQuery({ queryKey: ["admin-paper-assignments"], queryFn: () => systemService.listAdminPaperAssignments(), retry: false });
  const [assignAdminId, setAssignAdminId] = useState("");
  const [assignPaperId, setAssignPaperId] = useState("");
  const assign = useMutation({ mutationFn: () => systemService.assignAdminPaper({ adminId: assignAdminId, examCourseId: assignPaperId }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-paper-assignments"] }); setAssignPaperId(""); } });
  const unassign = useMutation({ mutationFn: (id: string) => systemService.unassignAdminPaper(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-paper-assignments"] }) });
  const setup = useQuery({ queryKey: ["exam-setup"], queryFn: () => examManagementService.listSetup(), enabled: open, retry: false });
  const create = useMutation({ mutationFn: () => examManagementService.create({ academicSessionId: sessionId, title, mode, durationMinutes: Number(duration), questionCount: Number(questionCount), isActive: active, courseIds }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-papers"] }); setOpen(false); setTitle(""); setCourseIds([]); }, });
  const toggle = (id: string) => setCourseIds(v => v.includes(id) ? v.filter(x => x !== id) : mode === "regular" ? [id] : [...v, id]);
  return <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="Examinations" subtitle="Create and manage examination papers" actions={<Button onClick={() => setOpen(v => !v)} className="tap-target rounded-xl"><Plus className="size-4" /> New examination</Button>}>
    {open && <section className="surface-card mb-8 rounded-2xl p-5"><SectionHeader title="Create examination" description="Create the examination event and attach its paper course(s)." />
      {setup.isError && <p className="mb-4 text-sm text-destructive">{setup.error instanceof Error ? setup.error.message : "Unable to load examination setup."}</p>}
      {!setup.isPending && !(setup.data?.sessions.length) && <p className="mb-4 rounded-xl border p-3 text-sm">No active academic session exists yet. Create an active academic session before creating an examination.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-2"><Label>Examination title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="First Semester Examination" /></div>
        <div className="grid gap-2"><Label>Academic session</Label><Select value={sessionId} onValueChange={setSessionId}><SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger><SelectContent>{(setup.data?.sessions ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.is_current ? " · Current" : ""}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>Mode</Label><Select value={mode} onValueChange={(v: ExamContext) => { setMode(v); if (v === "regular") setCourseIds(v => v.slice(0, 1)); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EXAM_CONTEXT_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>Duration (minutes)</Label><Input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} /></div>
        <div className="grid gap-2"><Label>Question count</Label><Input type="number" min="0" value={questionCount} onChange={e => setQuestionCount(e.target.value)} /></div>
      </div>
      <div className="mt-5"><Label>Paper/course{mode !== "regular" ? "s" : ""}</Label><div className="mt-2 max-h-60 overflow-auto rounded-xl border p-2">{(setup.data?.courses ?? []).map(c => <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary"><Checkbox checked={courseIds.includes(c.id)} onCheckedChange={() => toggle(c.id)} /><span><b>{c.code}</b> · {c.title}</span></label>)}</div></div>
      <label className="mt-4 flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={v => setActive(Boolean(v))} /> Activate immediately</label>
      {create.isError && <p className="mt-3 text-sm text-destructive">{create.error instanceof Error ? create.error.message : "Could not create examination."}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={create.isPending || !title.trim() || !sessionId || !courseIds.length || !(setup.data?.sessions.length)} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create examination"}</Button></div>
    </section>}
    <section className="surface-card mb-8 rounded-2xl p-5">
      <SectionHeader title="Admin paper assignments" description="A paper becomes visible in an Admin's Live Papers console only after the examination is active and this specific paper is assigned to that Admin." />
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Select value={assignAdminId} onValueChange={setAssignAdminId}><SelectTrigger><SelectValue placeholder="Select administrator" /></SelectTrigger><SelectContent>{(admins.data ?? []).filter((a) => a.active).map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName} · {a.email}</SelectItem>)}</SelectContent></Select>
        <Select value={assignPaperId} onValueChange={setAssignPaperId}><SelectTrigger><SelectValue placeholder="Select examination paper" /></SelectTrigger><SelectContent>{(exams.data ?? []).flatMap((e:any) => (e.courses ?? []).map((c:any) => <SelectItem key={c.id} value={c.id}>{e.title} · {c.courses?.code ?? "Course"} — {c.courses?.title ?? ""}{e.is_active ? " · LIVE" : " · Inactive"}</SelectItem>))}</SelectContent></Select>
        <Button className="rounded-xl" disabled={!assignAdminId || !assignPaperId || assign.isPending} onClick={() => assign.mutate()}><UserCheck className="size-4" />{assign.isPending ? "Assigning…" : "Assign paper"}</Button>
      </div>
      {assign.isError ? <p className="mt-3 text-sm text-destructive">{assign.error instanceof Error ? assign.error.message : "Unable to assign paper."}</p> : null}
      <div className="mt-5 grid gap-2">{(assignments.data ?? []).length ? (assignments.data ?? []).map((a) => <div key={a.assignmentId} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{a.adminName} <span className="font-normal text-muted-foreground">· {a.adminEmail}</span></p><p className="text-sm text-muted-foreground">{a.examTitle} · <b>{a.courseCode}</b> — {a.courseTitle}</p></div><Button variant="outline" size="sm" className="rounded-lg" disabled={unassign.isPending} onClick={() => unassign.mutate(a.assignmentId)}><UserMinus className="size-4" /> Unassign</Button></div>) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No administrator paper assignments yet.</p>}</div>
    </section>
    <SectionHeader title="All examinations" description="Examination definitions currently stored in Supabase." />
    <ServiceState query={exams} emptyTitle="No examinations configured" emptyDescription="Create the first examination above.">
      {(rows: any[]) => <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(exam => <article key={exam.id} className="surface-card grid gap-3 rounded-2xl p-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{exam.courseCode} · {EXAM_CONTEXT_LABELS[exam.mode === "pharmacy_prenational" ? "pharmacy-prenational" : exam.mode as ExamContext]}</p><h3 className="mt-1 font-display text-base font-bold">{exam.title}</h3></div><dl className="grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-secondary/60 py-2"><dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Questions</dt><dd className="text-sm font-semibold">{exam.question_count}</dd></div><div className="rounded-xl bg-secondary/60 py-2"><dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Duration</dt><dd className="text-sm font-semibold">{exam.duration_minutes} min</dd></div></dl><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" />{exam.is_active ? "Active" : "Inactive"} · {exam.courses?.length ?? 0} paper{(exam.courses?.length ?? 0) === 1 ? "" : "s"}</p></article>)}</div>}
    </ServiceState>
  </RoleShell>;
}

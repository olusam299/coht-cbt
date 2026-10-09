import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Trash2, UserCheck, UserMinus } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const unassign = useMutation({ mutationFn: (id: string) => systemService.unassignAdminPaper(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-paper-assignments"] }); qc.invalidateQueries({ queryKey: ["system", "admins"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to remove the assignment.") });
  const setup = useQuery({ queryKey: ["exam-setup"], queryFn: () => examManagementService.listSetup(), enabled: open, retry: false });
  const create = useMutation({ mutationFn: () => examManagementService.create({ academicSessionId: sessionId, title, mode, durationMinutes: Number(duration), questionCount: Number(questionCount), isActive: active, courseIds }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-papers"] }); setOpen(false); setTitle(""); setCourseIds([]); }, });
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const removeExam = useMutation({
    mutationFn: (id: string) => examManagementService.remove(id),
    onSuccess: () => { toast.success("Examination deleted."); qc.invalidateQueries({ queryKey: ["superadmin-papers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete the examination."),
  });
  const editing = (exams.data ?? []).find((e: any) => e.id === editExamId) ?? null;
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
      <div className="mt-5 grid gap-2">{(assignments.data ?? []).length ? (assignments.data ?? []).map((a) => <div key={a.assignmentId} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{a.adminName} <span className="font-normal text-muted-foreground">· {a.adminEmail}</span></p><p className="text-sm text-muted-foreground">{a.examTitle} · <b>{a.courseCode}</b> — {a.courseTitle}</p></div><Button variant="outline" size="sm" className="rounded-lg" disabled={unassign.isPending} onClick={() => unassign.mutate(a.assignmentId)}><UserMinus className="size-4" /> Unassign</Button></div>) : assignments.isPending ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Loading assignments…</p> : assignments.isError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{assignments.error instanceof Error ? assignments.error.message : "Could not load assignments."}</p> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No administrator paper assignments yet.</p>}</div>
    </section>
    <SectionHeader title="All examinations" description="Examinations and the papers attached to them." />
    <ServiceState query={exams} emptyTitle="No examinations configured" emptyDescription="Create the first examination above.">
      {(rows: any[]) => <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(exam => <article key={exam.id} className="surface-card grid gap-3 rounded-2xl p-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{exam.courseCode} · {EXAM_CONTEXT_LABELS[exam.mode === "pharmacy_prenational" ? "pharmacy-prenational" : exam.mode as ExamContext]}</p><h3 className="mt-1 font-display text-base font-bold">{exam.title}</h3></div><dl className="grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-secondary/60 py-2"><dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Questions</dt><dd className="text-sm font-semibold">{exam.question_count}</dd></div><div className="rounded-xl bg-secondary/60 py-2"><dt className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Duration</dt><dd className="text-sm font-semibold">{exam.duration_minutes} min</dd></div></dl><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" />{exam.is_active ? "Active" : "Inactive"} · {exam.courses?.length ?? 0} paper{(exam.courses?.length ?? 0) === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-muted-foreground">Student results on submission: <b>{exam.show_instant_results ? "Shown" : "Hidden"}</b></p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" className="flex-1 rounded-lg" onClick={() => setEditExamId(exam.id)}><Pencil className="size-3.5" /> Edit</Button><Button size="sm" variant="outline" className="rounded-lg text-destructive" disabled={removeExam.isPending} onClick={() => { if (window.confirm(`Delete examination "${exam.title}"? This cannot be undone.`)) removeExam.mutate(exam.id); }}><Trash2 className="size-3.5" /> Delete</Button></div></article>)}</div>}
    </ServiceState>
    <EditExamDialog exam={editing} onClose={() => setEditExamId(null)} />
  </RoleShell>;
}

function EditExamDialog({ exam, onClose }: { exam: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [active, setActive] = useState(false);
  const [instant, setInstant] = useState(false);
  const [courseId, setCourseId] = useState("");
  useEffect(() => {
    if (exam) { setTitle(exam.title); setDuration(String(exam.duration_minutes)); setActive(Boolean(exam.is_active)); setInstant(Boolean(exam.show_instant_results)); setCourseId(""); }
    // Re-seed only when a different examination is opened, not after each paper change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.id]);

  const setup = useQuery({ queryKey: ["exam-setup"], queryFn: () => examManagementService.listSetup(), enabled: Boolean(exam), retry: false });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["superadmin-papers"] }); qc.invalidateQueries({ queryKey: ["admin-paper-assignments"] }); };
  const fail = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);

  const save = useMutation({
    mutationFn: () => examManagementService.update({ examId: exam.id, title, durationMinutes: Number(duration), isActive: active, showInstantResults: instant }),
    onSuccess: () => { toast.success("Examination updated."); refresh(); onClose(); },
    onError: fail("Unable to update the examination."),
  });
  const addPaper = useMutation({
    mutationFn: () => examManagementService.addPaper({ examId: exam.id, courseId }),
    onSuccess: () => { toast.success("Paper added."); setCourseId(""); refresh(); },
    onError: fail("Unable to add the paper."),
  });
  const removePaper = useMutation({
    mutationFn: (id: string) => examManagementService.removePaper(id),
    onSuccess: () => { toast.success("Paper removed."); refresh(); },
    onError: fail("Unable to remove the paper."),
  });

  const papers: any[] = exam?.courses ?? [];
  const attached = new Set(papers.map((p) => p.course_id));
  const available = (setup.data?.courses ?? []).filter((c) => !attached.has(c.id));
  const live = Boolean(exam?.is_active);
  const invalid = !title.trim() || !(Number(duration) > 0);

  return <Dialog open={Boolean(exam)} onOpenChange={(v) => !v && onClose()}><DialogContent className="max-w-xl">
    <DialogHeader><DialogTitle>Edit examination</DialogTitle><DialogDescription>
      {live ? "This examination is live. Deactivate it (untick Active and save) before changing its title, duration or papers." : "Changes to title, duration and papers are allowed while the examination is inactive."}
    </DialogDescription></DialogHeader>
    <div className="grid gap-4 py-1">
      <div className="grid gap-2"><Label htmlFor="edit-exam-title">Title</Label><Input id="edit-exam-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor="edit-exam-duration">Duration (minutes)</Label><Input id="edit-exam-duration" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(v) => setActive(Boolean(v))} /> Active (visible to students and assigned admins)</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={instant} onCheckedChange={(v) => setInstant(Boolean(v))} /> Show instant results after submission</label>

      <div className="rounded-xl border p-3">
        <p className="text-sm font-semibold">Papers</p>
        <div className="mt-2 grid gap-1.5">
          {papers.length ? papers.map((p) => <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
            <span><b>{p.courses?.code ?? "Course"}</b> · {p.courses?.title ?? ""}</span>
            <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Remove paper" disabled={live || removePaper.isPending} onClick={() => removePaper.mutate(p.id)}><Trash2 className="size-3.5" /></Button>
          </div>) : <p className="text-sm text-muted-foreground">No papers attached.</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <Select value={courseId} onValueChange={setCourseId} disabled={live}><SelectTrigger className="flex-1"><SelectValue placeholder="Add a course as a paper" /></SelectTrigger><SelectContent>{available.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" disabled={live || !courseId || addPaper.isPending} onClick={() => addPaper.mutate()}><Plus className="size-4" /> Add</Button>
        </div>
      </div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={save.isPending || invalid} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

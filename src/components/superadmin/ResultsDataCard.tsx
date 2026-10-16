import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { academicService } from "@/services/academic";
import { examManagementService } from "@/services/exam-management";
import { resultsAdminService, scopeReady, type ResultScope, type ScopeTarget } from "@/services/results-admin";

const SCOPES: { value: ResultScope; label: string; hint: string }[] = [
  { value: "all", label: "All results", hint: "Every result in the system." },
  { value: "department", label: "A department", hint: "Results of students in one department." },
  { value: "examination", label: "An examination", hint: "Every paper of one examination." },
  { value: "paper", label: "A paper", hint: "One paper of an examination." },
];

const ACTION_LABEL = { archive: "Archived", restore: "Restored", delete: "Deleted" } as const;

/** Archive, restore or permanently delete results for everything, a department, an examination or a paper. */
export function ResultsDataCard() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<ResultScope>("examination");
  const [departmentId, setDepartmentId] = useState("");
  const [examId, setExamId] = useState("");
  const [examCourseId, setExamCourseId] = useState("");
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const structure = useQuery({ queryKey: ["academic-structure"], queryFn: () => academicService.listStructure(), retry: false });
  const exams = useQuery({ queryKey: ["superadmin-papers"], queryFn: () => examManagementService.list(), retry: false });

  const examList = (exams.data ?? []) as any[];
  const selectedExam = examList.find((e) => e.id === examId);
  const papers: any[] = selectedExam?.courses ?? [];

  const target: ScopeTarget = {
    scope,
    ...(scope === "department" && departmentId ? { departmentId } : {}),
    ...((scope === "examination" || scope === "paper") && examId ? { examId } : {}),
    ...(scope === "paper" && examCourseId ? { examCourseId } : {}),
  };
  const ready = scopeReady(target);

  const summary = useQuery({
    queryKey: ["results-scope", scope, departmentId, examId, examCourseId],
    queryFn: () => resultsAdminService.summary(target),
    enabled: ready,
    retry: false,
  });
  const log = useQuery({ queryKey: ["results-log"], queryFn: () => resultsAdminService.log(8), retry: false });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["results"] });
    qc.invalidateQueries({ queryKey: ["results-scope"] });
    qc.invalidateQueries({ queryKey: ["results-log"] });
  };
  const fail = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);

  const archive = useMutation({
    mutationFn: () => resultsAdminService.archive(target, reason),
    onSuccess: (n) => { toast.success(`${n} result${n === 1 ? "" : "s"} archived.`); refresh(); },
    onError: fail("Unable to archive."),
  });
  const restore = useMutation({
    mutationFn: () => resultsAdminService.restore(target, reason),
    onSuccess: (n) => { toast.success(`${n} result${n === 1 ? "" : "s"} restored.`); refresh(); },
    onError: fail("Unable to restore."),
  });
  const remove = useMutation({
    mutationFn: () => resultsAdminService.remove(target, reason),
    onSuccess: (n) => { toast.success(`${n} result${n === 1 ? "" : "s"} deleted permanently.`); setDeleteOpen(false); setTyped(""); refresh(); },
    onError: fail("Unable to delete."),
  });

  const scopeText = useMemo(() => {
    if (scope === "all") return "all results";
    if (scope === "department") {
      const d = (structure.data ?? []).find((x) => x.id === departmentId);
      return d ? `the results of ${d.code} · ${d.name}` : "the chosen department";
    }
    if (scope === "examination") return selectedExam ? `the results of "${selectedExam.title}"` : "the chosen examination";
    const p = papers.find((x) => x.id === examCourseId);
    return p ? `the results of ${p.courses?.code ?? "the paper"} in "${selectedExam?.title}"` : "the chosen paper";
  }, [scope, departmentId, examCourseId, selectedExam, papers, structure.data]);

  const s = summary.data;
  const busy = archive.isPending || restore.isPending || remove.isPending;

  return (
    <Card className="surface-card rounded-2xl p-5">
      <p className="font-display font-bold">Results: archive or delete</p>
      <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
        Archiving hides results from Results &amp; reports and its exports, and can be undone. Deleting removes the result rows permanently. Sittings and answers are not touched by either.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Apply to</Label>
          <Select value={scope} onValueChange={(v) => { setScope(v as ResultScope); setDepartmentId(""); setExamId(""); setExamCourseId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SCOPES.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{SCOPES.find((x) => x.value === scope)?.hint}</p>
        </div>

        {scope === "department" ? (
          <div className="grid gap-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder={structure.isPending ? "Loading…" : "Select department"} /></SelectTrigger>
              <SelectContent>{(structure.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.code} · {d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : null}

        {scope === "examination" || scope === "paper" ? (
          <div className="grid gap-2">
            <Label>Examination</Label>
            <Select value={examId} onValueChange={(v) => { setExamId(v); setExamCourseId(""); }}>
              <SelectTrigger><SelectValue placeholder={exams.isPending ? "Loading…" : "Select examination"} /></SelectTrigger>
              <SelectContent>{examList.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : null}

        {scope === "paper" ? (
          <div className="grid gap-2 md:col-start-2">
            <Label>Paper</Label>
            <Select value={examCourseId} onValueChange={setExamCourseId} disabled={!examId}>
              <SelectTrigger><SelectValue placeholder={examId ? "Select paper" : "Choose an examination first"} /></SelectTrigger>
              <SelectContent>{papers.map((p) => <SelectItem key={p.id} value={p.id}>{p.courses?.code ?? "Course"} · {p.courses?.title ?? ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        <Label htmlFor="results-reason">Reason (optional, kept in the log)</Label>
        <Input id="results-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. First semester 2025/2026 closed" />
      </div>

      <div className="mt-4 rounded-xl bg-secondary/60 px-4 py-3 text-sm" aria-live="polite">
        {!ready ? "Choose what to apply this to." : summary.isPending ? "Counting…" : summary.isError ? <span className="text-destructive">{summary.error instanceof Error ? summary.error.message : "Could not count results."}</span> : (
          <>This covers <b>{s?.total ?? 0}</b> result{s?.total === 1 ? "" : "s"}: <b>{s?.active ?? 0}</b> active and <b>{s?.archived ?? 0}</b> archived.</>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-xl" disabled={!ready || busy || !s?.active} onClick={() => { if (window.confirm(`Archive ${s?.active} result(s) in ${scopeText}? You can restore them later.`)) archive.mutate(); }}>
          <Archive className="size-4" aria-hidden /> Archive{s?.active ? ` ${s.active}` : ""}
        </Button>
        <Button variant="outline" className="rounded-xl" disabled={!ready || busy || !s?.archived} onClick={() => { if (window.confirm(`Restore ${s?.archived} archived result(s) in ${scopeText}?`)) restore.mutate(); }}>
          <ArchiveRestore className="size-4" aria-hidden /> Restore{s?.archived ? ` ${s.archived}` : ""}
        </Button>
        <Button variant="outline" className="rounded-xl border-destructive/40 text-destructive" disabled={!ready || busy || !s?.total} onClick={() => { setTyped(""); setDeleteOpen(true); }}>
          <Trash2 className="size-4" aria-hidden /> Delete permanently{s?.total ? ` ${s.total}` : ""}
        </Button>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">Recent actions</p>
        <div className="mt-2 grid gap-1.5">
          {log.isSuccess && !log.data.length ? <p className="text-sm text-muted-foreground">Nothing has been archived or deleted yet.</p> : null}
          {(log.data ?? []).map((l) => (
            <p key={l.id} className="rounded-lg bg-secondary/40 px-3 py-1.5 text-xs">
              <b>{ACTION_LABEL[l.action]}</b> {l.affected} · {l.scopeLabel}
              <span className="text-muted-foreground"> · {l.performedBy} · {new Date(l.createdAt).toLocaleString()}{l.reason ? ` · ${l.reason}` : ""}</span>
            </p>
          ))}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!v) { setDeleteOpen(false); setTyped(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {s?.total ?? 0} result{s?.total === 1 ? "" : "s"} permanently?</DialogTitle>
            <DialogDescription>
              This removes {scopeText}, including archived ones. It cannot be undone. Archive them instead if you may need them again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setTyped(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={typed !== "DELETE" || remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? "Deleting…" : "Delete permanently"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

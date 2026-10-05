import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Download, FileUp, RefreshCw, ShieldCheck, TriangleAlert, UploadCloud, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleShell, SectionHeader, StatTile } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { dataManagementService } from "@/services/data-management";
import { StudentOtpPanel } from "@/components/superadmin/StudentOtpPanel";
import type { ImportEntity, ImportIssue, ImportValidationResult } from "@/services/data-management";

export const Route = createFileRoute("/superadmin/data")({
  head: () => ({ meta: [{ title: "Data Management | COHT CBT SuperAdmin" }] }),
  component: SuperAdminData,
});

const ENTITY_META: Record<ImportEntity, { label: string; description: string }> = {
  students: { label: "Students", description: "Register or update candidates against the authoritative Department → Programme structure." },
  courses: { label: "Courses", description: "Add or update course definitions with department and programme ownership." },
  registrations: { label: "Registrations", description: "Attach students to courses for a named academic session, including resits and carry-overs." },
  questions: { label: "Question Bank", description: "Load exam questions and answer keys into the examination question bank." },
};

const TEMPLATES: Record<ImportEntity, string> = {
  students: "reg_no,full_name,department_code,programme_code,level",
  courses: "code,title,department_code,programme_code,level,semester,credit_units",
  registrations: "reg_no,course_code,academic_session_name,registration_type",
  questions: "exam_id,question_number,question_text,option_a,option_b,option_c,option_d,option_e,correct_option",
};

function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some((v) => v.trim() !== "")) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()])));
}

async function readImportFile(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("JSON import must contain an array of row objects.");
    return parsed;
  }
  if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv") return parseCsv(text);
  throw new Error("Use CSV or JSON for imports. For an Excel workbook, save the relevant sheet as CSV first.");
}

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function ImportPanel({ entity }: { entity: ImportEntity }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function loadFile(next: File | null) {
    setFile(next); setValidation(null); setRows([]);
    if (!next) return;
    try {
      const parsed = await readImportFile(next);
      if (!parsed.length) throw new Error("The file contains no data rows.");
      setRows(parsed);
      toast.success(`${parsed.length.toLocaleString()} rows loaded for review.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to read import file."); }
  }

  async function validate() {
    if (!rows.length) return toast.error("Choose an import file first.");
    setBusy(true);
    try {
      const result = await dataManagementService.validateImport({ entity, rows });
      setValidation(result);
      if (result.errorRows) toast.error(`${result.errorRows} row(s) need correction before confirmation.`);
      else toast.success("Validation completed. Review the warnings before confirming.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Validation failed."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!validation || validation.errorRows > 0 || !validation.normalizedRows.length) return;
    setConfirming(true);
    try {
      // The live superadmin_confirm_import() re-validates its input and then
      // persists its OWN server-normalized rows. It therefore expects the
      // human-facing rows (department_code/programme_code), NOT normalizedRows,
      // which carry department_id/programme_id and would fail re-validation.
      const result = await dataManagementService.confirmImport({ entity, rows });
      toast.success(`Import complete: ${result.imported} added, ${result.updated} updated, ${result.skipped} skipped.`);
      setFile(null); setRows([]); setValidation(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import confirmation failed."); }
    finally { setConfirming(false); }
  }

  const issues = validation?.issues ?? [];
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return <div className="grid gap-5">
    <Card className="surface-card rounded-2xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display font-bold">1 · Upload</p>
          <p className="mt-1 text-sm text-muted-foreground">CSV or JSON. Keep the column names from the template exactly.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="tap-target rounded-xl" onClick={() => downloadText(`${entity}-template.csv`, TEMPLATES[entity] + "\n")}>
            <Download className="size-4" /> Template
          </Button>
          <label className="tap-target inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <UploadCloud className="size-4" /> Choose file
            <Input type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => void loadFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
      {file ? <div className="mt-4 flex items-center gap-3 rounded-xl bg-secondary/60 p-3 text-sm"><FileUp className="size-4" /><span className="min-w-0 flex-1 truncate">{file.name}</span><Badge variant="secondary">{rows.length.toLocaleString()} rows</Badge></div> : null}
    </Card>

    <Card className="surface-card rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-display font-bold">2 · Validate & Review</p><p className="mt-1 text-sm text-muted-foreground">Nothing is written until you explicitly confirm a clean validation.</p></div>
        <Button className="tap-target rounded-xl" disabled={!rows.length || busy} onClick={() => void validate()}>{busy ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {busy ? "Validating…" : "Validate import"}</Button>
      </div>
      {validation ? <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Rows" value={String(validation.totalRows)} />
          <StatTile label="Valid" value={String(validation.validRows)} tone="success" />
          <StatTile label="Warnings" value={String(validation.warningRows)} tone="warning" />
          <StatTile label="Errors" value={String(validation.errorRows)} tone="danger" />
          <StatTile label="Duplicates" value={String(validation.duplicateRows)} />
        </div>
        <div className="mt-5 grid gap-2">
          {errors.slice(0, 30).map((issue, n) => <Issue key={`e-${n}`} issue={issue} />)}
          {warnings.slice(0, 30).map((issue, n) => <Issue key={`w-${n}`} issue={issue} />)}
          {(errors.length + warnings.length) > 60 ? <p className="text-xs text-muted-foreground">Showing the first 60 issues. The server retains the complete validation count.</p> : null}
          {!issues.length ? <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-sm"><CheckCircle2 className="size-4 text-success" /> No validation issues found.</div> : null}
        </div>
      </> : null}
    </Card>

    <Card className="surface-card rounded-2xl border-primary/20 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-display font-bold">3 · Confirm</p><p className="mt-1 text-sm text-muted-foreground">The server performs the final write under the authenticated SuperAdmin role.</p></div>
        <Button className="tap-target rounded-xl" disabled={!validation || validation.errorRows > 0 || !validation.normalizedRows.length || confirming} onClick={() => void confirm()}>{confirming ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {confirming ? "Importing…" : "Confirm & import"}</Button>
      </div>
      {validation?.errorRows ? <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><TriangleAlert className="size-4" /> Fix all validation errors and validate again before confirming.</p> : null}
    </Card>
  </div>;
}

function Issue({ issue }: { issue: ImportIssue }) {
  return <div className="flex gap-2 rounded-xl border p-3 text-sm"><span className="shrink-0 font-mono text-xs text-muted-foreground">Row {issue.row}</span><span className="min-w-0 flex-1">{issue.message}</span><Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>{issue.severity}</Badge></div>;
}

function SuperAdminData() {
  const reset = useMutation({ mutationFn: () => dataManagementService.resetApplicationData(), onSuccess: (r) => toast.success(`Application data reset. ${r.student_auth_accounts_removed} student Auth account(s) removed; staff accounts preserved.`), onError: (e) => toast.error(e instanceof Error ? e.message : "Reset failed.") });
  const clearStudents = useMutation({ mutationFn: () => dataManagementService.clearStudents(), onSuccess: (r) => toast.success(`Students cleared: ${r.students_deleted.toLocaleString()} student(s) and ${r.student_auth_accounts_removed.toLocaleString()} Auth account(s) removed.`), onError: (e) => toast.error(e instanceof Error ? e.message : "Student clear failed.") });
  const clearCourses = useMutation({ mutationFn: () => dataManagementService.clearCourses(), onSuccess: (r) => toast.success(`Courses cleared: ${r.deleted.toLocaleString()} course(s).`), onError: (e) => toast.error(e instanceof Error ? e.message : "Course clear failed.") });
  const clearRegistrations = useMutation({ mutationFn: () => dataManagementService.clearRegistrations(), onSuccess: (r) => toast.success(`Registrations cleared: ${r.deleted.toLocaleString()} registration(s).`), onError: (e) => toast.error(e instanceof Error ? e.message : "Registration clear failed.") });
  const clearQuestionBank = useMutation({ mutationFn: () => dataManagementService.clearQuestionBank(), onSuccess: (r) => toast.success(`Question Bank cleared: ${r.questions_deleted.toLocaleString()} question(s).`), onError: (e) => toast.error(e instanceof Error ? e.message : "Question Bank clear failed.") });

  function confirmAction(message: string, action: () => void) {
    if (window.confirm(message)) action();
  }
  function runReset() {
    confirmAction("This will permanently clear students, courses, registrations, examinations, questions, results, attendance, OTPs and other application data. Staff accounts and the schema will be preserved. Continue?", () => reset.mutate());
  }
  return <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="Data Management" subtitle="Controlled import of the examination data foundation">
    <SectionHeader title="Institution data" description="Upload, validate, review and explicitly confirm changes. No import is silently accepted." />
    <StudentOtpPanel />
    <Card className="surface-card rounded-2xl border-destructive/20 p-5">
      <div>
        <p className="font-display font-bold">Clear selected data</p>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Use these targeted actions when correcting an import. Each button calls a protected SuperAdmin RPC and clears only its named data set. Courses and Question Bank refuse to delete when doing so would silently destroy dependent examination data.</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Button variant="outline" className="min-h-12 justify-start rounded-xl border-destructive/30" disabled={clearStudents.isPending} onClick={() => confirmAction("Clear ALL registered students? This removes their student registrations, exam sessions/results, OTPs, attendance and student Auth accounts. Departments, programmes, courses, examinations and staff accounts are preserved. Continue?", () => clearStudents.mutate())}>
          <Trash2 className="size-4 text-destructive" /> {clearStudents.isPending ? "Clearing students…" : "Clear Students"}
        </Button>
        <Button variant="outline" className="min-h-12 justify-start rounded-xl border-destructive/30" disabled={clearCourses.isPending} onClick={() => confirmAction("Clear ALL courses? This action will proceed only if there are no student registrations and no examination papers. Departments, programmes, students and staff are preserved. Continue?", () => clearCourses.mutate())}>
          <Trash2 className="size-4 text-destructive" /> {clearCourses.isPending ? "Clearing courses…" : "Clear Courses"}
        </Button>
        <Button variant="outline" className="min-h-12 justify-start rounded-xl border-destructive/30" disabled={clearRegistrations.isPending} onClick={() => confirmAction("Clear ALL student-course registrations? Students, courses, examinations and question bank are preserved. Continue?", () => clearRegistrations.mutate())}>
          <Trash2 className="size-4 text-destructive" /> {clearRegistrations.isPending ? "Clearing registrations…" : "Clear Registrations"}
        </Button>
        <Button variant="outline" className="min-h-12 justify-start rounded-xl border-destructive/30" disabled={clearQuestionBank.isPending} onClick={() => confirmAction("Clear the ENTIRE Question Bank? This action will proceed only if no student answer records reference the questions. Continue?", () => clearQuestionBank.mutate())}>
          <Trash2 className="size-4 text-destructive" /> {clearQuestionBank.isPending ? "Clearing questions…" : "Clear Question Bank"}
        </Button>
      </div>
      <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Safety:</strong> these buttons do not use the full application reset. They do not delete departments, programmes, academic sessions, staff accounts or database schema. If a requested deletion would break existing examination data, the server blocks it instead of cascading unexpectedly.
      </div>
    </Card>
    <Card className="surface-card rounded-2xl border-destructive/30 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-display font-bold text-destructive">Reset application data</p><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Full test-data reset. Use this only when intentionally starting a completely clean import cycle. SuperAdmin and Admin Auth accounts are preserved; the schema, RLS and RPCs are not dropped.</p></div>
        <Button variant="destructive" className="rounded-xl" disabled={reset.isPending} onClick={runReset}>{reset.isPending ? "Resetting…" : "Reset imported data"}</Button>
      </div>
    </Card>
    <Tabs defaultValue="students" className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
        {(Object.keys(ENTITY_META) as ImportEntity[]).map((entity) => <TabsTrigger key={entity} value={entity} className="min-h-10 rounded-lg">{ENTITY_META[entity].label}</TabsTrigger>)}
      </TabsList>
      {(Object.keys(ENTITY_META) as ImportEntity[]).map((entity) => <TabsContent key={entity} value={entity} className="mt-5"><p className="mb-5 max-w-3xl text-sm text-muted-foreground">{ENTITY_META[entity].description}</p><ImportPanel entity={entity} /></TabsContent>)}
    </Tabs>
  </RoleShell>;
}

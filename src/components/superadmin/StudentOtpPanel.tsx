import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Printer, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/layout/RoleShell";
import { studentOtpService, type StudentOtpRow } from "@/services/student-otp";

const ALL = "__all__";
const LEVELS = ["100", "200", "300", "400", "500", "600"];
const esc = (v: string) => v.replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] ?? c));
const courseText = (s: StudentOtpRow) => s.activated_courses.length ? s.activated_courses.map((c) => `${c.code} · ${c.title}`).join(" | ") : "No active registered course";

function printPdf(rows: StudentOtpRow[]) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow pop-ups to print the OTP cards.");
  const pages = Array.from({ length: Math.ceil(rows.length / 16) }, (_, page) => rows.slice(page * 16, page * 16 + 16));
  win.document.write(`<!doctype html><html><head><title>COHT Current Student OTP Cards</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.sheet{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:3mm;width:194mm;height:281mm;break-after:page}.sheet:last-child{break-after:auto}.card{border:1px solid #888;border-radius:3mm;padding:3mm;display:flex;flex-direction:column;min-width:0;overflow:hidden}.college{font-size:7px;font-weight:700;letter-spacing:.4px}.name{font-size:10px;font-weight:700;margin-top:2mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reg{font-size:8px;margin-top:1mm}.courses{font-size:7px;line-height:1.25;margin-top:2mm;flex:1;overflow:hidden}.otp{font:700 17px/1.1 monospace;letter-spacing:2px;text-align:center;border-top:1px dashed #777;padding-top:2mm;margin-top:2mm}</style></head><body>${pages.map((page) => `<section class="sheet">${page.map((s) => `<article class="card"><div class="college">COLLEGE OF HEALTH CBT</div><div class="name">${esc(s.full_name)}</div><div class="reg">${esc(s.reg_no)}</div><div class="courses">${esc(courseText(s))}</div><div class="otp">${esc(s.current_otp || "—")}</div></article>`).join("")}</section>`).join("")}</body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 350);
}

function exportExcel(rows: StudentOtpRow[]) {
  const cards = rows.map((s) => `<td style="border:1px solid #999;width:25%;height:130px;vertical-align:top;padding:10px"><b>COLLEGE OF HEALTH CBT</b><br><br><b>${esc(s.full_name)}</b><br>${esc(s.reg_no)}<br><small>${esc(courseText(s))}</small><br><br><strong style="font-size:20px;letter-spacing:3px">${esc(s.current_otp || "—")}</strong></td>`);
  const tables = Array.from({ length: Math.ceil(cards.length / 16) }, (_, page) => { const p = cards.slice(page * 16, page * 16 + 16); return `<table style="border-collapse:collapse;width:100%;page-break-after:always"><tbody>${Array.from({ length: 4 }, (_, r) => `<tr>${p.slice(r * 4, r * 4 + 4).join("")}</tr>`).join("")}</tbody></table>`; }).join("");
  const url = URL.createObjectURL(new Blob([`<html><body>${tables}</body></html>`], { type: "application/vnd.ms-excel" }));
  const a = document.createElement("a"); a.href = url; a.download = "COHT-current-student-OTPs.xls"; a.click(); URL.revokeObjectURL(url);
}

export function StudentOtpPanel() {
  const qc = useQueryClient();
  const [department, setDepartment] = useState(ALL);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState(ALL);
  const [showStudent, setShowStudent] = useState(false);
  const departments = useQuery({ queryKey: ["otp-departments"], queryFn: studentOtpService.listDepartments, staleTime: 300000, retry: false });
  const students = useQuery({ queryKey: ["student-otps", department, search], queryFn: () => studentOtpService.list({ departmentId: department === ALL ? undefined : department, search }), enabled: showStudent, staleTime: 10000, retry: false });
  const print = useMutation({ mutationFn: async () => { const r = await studentOtpService.ensureCurrent({ departmentId: department === ALL ? undefined : department }); const rows = (await studentOtpService.list({ departmentId: department === ALL ? undefined : department })).filter((s:any) => level === ALL || String(s.level ?? "") === level); return { r, rows }; }, onSuccess: ({ r, rows }) => { qc.invalidateQueries({ queryKey: ["student-otps"] }); if (!rows.length) { toast.error("No students were found for this selection."); return; } if (r.failures.length) toast.warning(`${r.failures.length} student account(s) could not be prepared; see console for details.`); printPdf(rows); }, onError: e => toast.error(e instanceof Error ? e.message : "Unable to prepare OTP cards.") });
  const show = useMutation({ mutationFn: async () => { const matches = await studentOtpService.list({ departmentId: department === ALL ? undefined : department, search }); const first = matches[0]; if (matches.length !== 1 || !first) return matches; const r = await studentOtpService.ensureCurrent({ studentId: first.student_id }); return [{ ...first, current_otp: r.students[0]?.otp ?? first.current_otp }]; }, onSuccess: rows => { qc.setQueryData(["student-otps", department, search], rows); if (!rows.length) toast.error("No matching student found."); else if (rows.length > 1) toast.info("More than one student matched. Refine the search with the registration number."); }, onError: e => toast.error(e instanceof Error ? e.message : "Unable to retrieve the student OTP.") });
  const rows = ((students.data ?? []) as StudentOtpRow[]).filter((s) => level === ALL || String((s as any).level ?? "") === level);
  const title = useMemo(() => `${department === ALL ? "All departments" : (departments.data ?? []).find((d: any) => d.id === department)?.name ?? "Department"} · ${level === ALL ? "All levels" : `${level} level`}`, [department, departments.data, level]);
  return <Card className="surface-card rounded-2xl p-5">
    <SectionHeader title="Student OTP desk" description="Six-character alphanumeric examination credentials. Current OTPs are visible only to SuperAdmin." />
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]">
      <Select value={department} onValueChange={setDepartment}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All departments</SelectItem>{(departments.data ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} · {d.name}</SelectItem>)}</SelectContent></Select>
      <Select value={level} onValueChange={setLevel}><SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All levels</SelectItem>{LEVELS.map((v) => <SelectItem key={v} value={v}>{v} level</SelectItem>)}</SelectContent></Select>
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Student name or registration number" /></div>
      <Button variant="outline" className="rounded-xl" disabled={show.isPending || !search.trim()} onClick={() => { setShowStudent(true); show.mutate(); }}><ShieldCheck className="size-4" />{show.isPending ? "Looking up…" : "Show student OTP"}</Button>
      <Button className="rounded-xl" disabled={print.isPending} onClick={() => print.mutate()}><Printer className="size-4" />{print.isPending ? "Preparing…" : `Print Current OTP · ${title}`}</Button>
    </div>
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><FileSpreadsheet className="size-3.5" />The print action prepares any missing current OTPs and opens an A4 16-card print layout. Use the browser's Save as PDF option for PDF, or use Excel cards below.</div>
    {showStudent ? <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowStudent(false)}>Hide student OTP</Button></div> : null}
    {showStudent ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{students.isPending || show.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.map(s => <article key={s.student_id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{s.full_name}</p><p className="text-xs text-muted-foreground">{s.reg_no}</p></div><code className="rounded-lg bg-secondary px-2 py-1 font-mono text-base font-bold tracking-[.2em]">{s.current_otp || "—"}</code></div><p className="mt-3 text-xs text-muted-foreground">{courseText(s)}</p></article>)}</div> : null}
    <div className="mt-4"><Button variant="outline" size="sm" className="rounded-lg" disabled={print.isPending} onClick={async () => { try { const r = await studentOtpService.ensureCurrent({ departmentId: department === ALL ? undefined : department }); const rows = (await studentOtpService.list({ departmentId: department === ALL ? undefined : department })).filter((s:any) => level === ALL || String(s.level ?? "") === level); if (!rows.length) { toast.error("No students found for this selection."); return; } if (r.failures.length) console.warn(r.failures); exportExcel(rows); qc.invalidateQueries({ queryKey: ["student-otps"] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Excel export failed."); } }}><FileSpreadsheet className="size-4" /> Excel cards</Button></div>
  </Card>;
}

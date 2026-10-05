import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, GraduationCap, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RoleShell, SectionHeader, StatTile } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { academicService, type DepartmentRecord } from "@/services/academic";

export const Route = createFileRoute("/superadmin/academic")({
  head: () => ({ meta: [{ title: "Academic Structure | COHT CBT SuperAdmin" }] }),
  component: SuperAdminAcademic,
});

function SuperAdminAcademic() {
  const qc = useQueryClient();
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [programmeDepartment, setProgrammeDepartment] = useState<DepartmentRecord | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const sessions = useQuery({ queryKey: ["academic-sessions"], queryFn: academicService.listSessions, retry: false });
  const structure = useQuery({ queryKey: ["academic-structure"], queryFn: academicService.listStructure, retry: false });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["academic-structure"] }); qc.invalidateQueries({ queryKey: ["academic-sessions"] }); };
  const createDepartment = useMutation({
    mutationFn: academicService.createDepartment,
    onSuccess: () => { toast.success("Department added successfully."); setDepartmentOpen(false); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to add department."),
  });
  const createSession = useMutation({
    mutationFn: academicService.createSession,
    onSuccess: () => { toast.success("Academic session created successfully."); setSessionOpen(false); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to create academic session."),
  });
  const setCurrent = useMutation({ mutationFn: academicService.setSessionCurrent, onSuccess: () => { toast.success("Current academic session updated."); refresh(); }, onError: e => toast.error(e instanceof Error ? e.message : "Unable to change current session.") });
  const setActive = useMutation({ mutationFn: academicService.setSessionActive, onSuccess: () => { toast.success("Academic session status updated."); refresh(); }, onError: e => toast.error(e instanceof Error ? e.message : "Unable to change session status.") });
  const createProgramme = useMutation({
    mutationFn: academicService.createProgramme,
    onSuccess: () => { toast.success("Programme added successfully."); setProgrammeDepartment(null); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to add programme."),
  });

  const departments = structure.data ?? [];
  const programmeCount = departments.reduce((n, d) => n + d.programmes.length, 0);

  return <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="Academic Structure" subtitle="Maintain the Department → Programme/Cadre foundation used by student registration.">
    <section className="surface-card mb-6 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays className="size-5" /><h2 className="font-display text-lg font-bold">Academic sessions</h2></div><p className="mt-1 text-sm text-muted-foreground">Create and control the active/current academic session used by examinations and registrations.</p></div><Button className="tap-target rounded-xl" onClick={() => setSessionOpen(true)}><Plus className="size-4" /> Add session</Button></div>
      {sessions.isError ? <p className="mt-4 text-sm text-destructive">{sessions.error instanceof Error ? sessions.error.message : "Unable to load academic sessions."}</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{(sessions.data ?? []).map(s => <div key={s.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.start_date ?? "No start date"}{s.end_date ? ` → ${s.end_date}` : ""}</p></div><div className="flex gap-2">{s.is_current && <Badge>Current</Badge>}<Badge variant={s.is_active ? "secondary" : "outline"}>{s.is_active ? "Active" : "Inactive"}</Badge></div></div><div className="mt-3 flex flex-wrap gap-2">{!s.is_current && s.is_active && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setCurrent.mutate(s.id)} disabled={setCurrent.isPending}>Make current</Button>}{!s.is_current && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setActive.mutate({sessionId:s.id,active:!s.is_active})} disabled={setActive.isPending}>{s.is_active ? "Deactivate" : "Activate"}</Button>}</div></div>)}</div>}
    </section>
    <SectionHeader title="Academic structure" description="Add institutional departments and their programmes/cadres here before importing students that belong to them." actions={<Button variant="outline" className="tap-target rounded-xl" onClick={() => refresh()} disabled={structure.isFetching}><RefreshCw className={`size-4 ${structure.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>} />

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatTile label="Departments" value={String(departments.length)} />
      <StatTile label="Programmes / cadres" value={String(programmeCount)} />
      <StatTile label="Active structure" value={structure.isError ? "Unavailable" : "Live"} tone={structure.isError ? "danger" : "success"} />
    </div>

    <div className="mt-6 flex flex-wrap gap-3">
      <Button className="tap-target rounded-xl" onClick={() => setDepartmentOpen(true)}><Plus className="size-4" /> Add department</Button>
      <Button variant="outline" className="tap-target rounded-xl" disabled={!departments.length} onClick={() => setProgrammeDepartment(departments[0] ?? null)}><Plus className="size-4" /> Add programme / cadre</Button>
    </div>

    {structure.isError ? <Card className="mt-6 rounded-2xl border-destructive/30 p-5"><p className="font-semibold">Academic structure could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">{structure.error instanceof Error ? structure.error.message : "Try refreshing."}</p></Card> : <div className="mt-6 grid gap-4 lg:grid-cols-2">{departments.map((department) => <Card key={department.id} className="surface-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="rounded-xl bg-primary/10 p-2.5"><Building2 className="size-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display font-bold">{department.name}</h3><Badge variant="secondary">{department.code}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Department</p></div></div><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setProgrammeDepartment(department)}><Plus className="size-4" /> Programme</Button></div>
      <div className="mt-5 space-y-2">{department.programmes.length ? department.programmes.map((programme) => <div key={programme.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="flex min-w-0 items-center gap-3"><GraduationCap className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{programme.name}</p><p className="text-xs text-muted-foreground">{programme.code}{programme.duration_years ? ` · ${programme.duration_years} years` : ""}</p></div></div><Badge variant={programme.is_active ? "secondary" : "outline"}>{programme.is_active ? "Active" : "Inactive"}</Badge></div>) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No programme/cadre has been added yet.</p>}</div>
    </Card>)}</div>}

    <AddSessionDialog open={sessionOpen} onOpenChange={setSessionOpen} pending={createSession.isPending} onSubmit={(v) => createSession.mutate(v)} />
    <AddDepartmentDialog open={departmentOpen} onOpenChange={setDepartmentOpen} pending={createDepartment.isPending} onSubmit={(v) => createDepartment.mutate(v)} />
    <AddProgrammeDialog department={programmeDepartment} onClose={() => setProgrammeDepartment(null)} pending={createProgramme.isPending} onSubmit={(v) => createProgramme.mutate(v)} />
  </RoleShell>;
}

function AddDepartmentDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (v: { code: string; name: string }) => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const close = (v: boolean) => { if (!v) { setCode(""); setName(""); } onOpenChange(v); };
  return <Dialog open={open} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>Add department</DialogTitle><DialogDescription>Create a new authoritative department. The code must be unique.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="dept-code">Department code</Label><Input id="dept-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. DIT" autoCapitalize="characters" /></div><div className="grid gap-2"><Label htmlFor="dept-name">Department name</Label><Input id="dept-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dental Technology" /></div></div><DialogFooter><Button variant="ghost" onClick={() => close(false)}>Cancel</Button><Button onClick={() => onSubmit({ code, name })} disabled={pending || code.trim().length < 2 || name.trim().length < 2}>{pending ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />} Add department</Button></DialogFooter></DialogContent></Dialog>;
}

function AddProgrammeDialog({ department, onClose, pending, onSubmit }: { department: DepartmentRecord | null; onClose: () => void; pending: boolean; onSubmit: (v: { departmentId: string; code: string; name: string; durationYears: number | null }) => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [duration, setDuration] = useState("");
  const open = Boolean(department);
  const close = () => { setCode(""); setName(""); setDuration(""); onClose(); };
  return <Dialog open={open} onOpenChange={v => !v && close()}><DialogContent><DialogHeader><DialogTitle>Add programme / cadre</DialogTitle><DialogDescription>{department ? `Add a programme under ${department.code} · ${department.name}.` : "Select a department."}</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="programme-code">Programme code</Label><Input id="programme-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. ND" /></div><div className="grid gap-2"><Label htmlFor="programme-name">Programme / cadre name</Label><Input id="programme-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. National Diploma" /></div><div className="grid gap-2"><Label htmlFor="programme-duration">Duration (years, optional)</Label><Input id="programme-duration" inputMode="numeric" value={duration} onChange={e => setDuration(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 2" /></div></div><DialogFooter><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={() => department && onSubmit({ departmentId: department.id, code, name, durationYears: duration ? Number(duration) : null })} disabled={pending || !department || code.trim().length < 2 || name.trim().length < 2}>{pending ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />} Add programme</Button></DialogFooter></DialogContent></Dialog>;
}

function AddSessionDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (v: { name: string; startDate: string | null; endDate: string | null; isCurrent: boolean }) => void }) {
  const [name,setName]=useState(""); const [start,setStart]=useState(""); const [end,setEnd]=useState(""); const [current,setCurrent]=useState(false);
  const close=(v:boolean)=>{if(!v){setName("");setStart("");setEnd("");setCurrent(false);} onOpenChange(v);};
  return <Dialog open={open} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>Add academic session</DialogTitle><DialogDescription>Create the session that examinations and registrations will reference.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Session name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="2026/2027" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Start date</Label><Input type="date" value={start} onChange={e=>setStart(e.target.value)} /></div><div className="grid gap-2"><Label>End date</Label><Input type="date" value={end} onChange={e=>setEnd(e.target.value)} /></div></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={current} onCheckedChange={v=>setCurrent(Boolean(v))} /> Make this the current session</label></div><DialogFooter><Button variant="ghost" onClick={()=>close(false)}>Cancel</Button><Button onClick={()=>onSubmit({name,startDate:start||null,endDate:end||null,isCurrent:current})} disabled={pending||name.trim().length<4}>{pending?<RefreshCw className="size-4 animate-spin"/>:<Plus className="size-4"/>} Create session</Button></DialogFooter></DialogContent></Dialog>;
}

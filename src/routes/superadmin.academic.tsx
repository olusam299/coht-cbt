import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, GraduationCap, Pencil, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { academicService, type AcademicSessionRecord, type DepartmentRecord, type ProgrammeRecord } from "@/services/academic";

export const Route = createFileRoute("/superadmin/academic")({
  head: () => ({ meta: [{ title: "Academic Structure | COHT CBT SuperAdmin" }] }),
  component: SuperAdminAcademic,
});

function SuperAdminAcademic() {
  const qc = useQueryClient();
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [programmeDepartment, setProgrammeDepartment] = useState<DepartmentRecord | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editSession, setEditSession] = useState<AcademicSessionRecord | null>(null);
  const [editDepartment, setEditDepartment] = useState<DepartmentRecord | null>(null);
  const [editProgramme, setEditProgramme] = useState<ProgrammeRecord | null>(null);
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

  const failure = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);
  const updateSession = useMutation({ mutationFn: academicService.updateSession, onSuccess: () => { toast.success("Academic session updated."); setEditSession(null); refresh(); }, onError: failure("Unable to update the session.") });
  const deleteSession = useMutation({ mutationFn: academicService.deleteSession, onSuccess: () => { toast.success("Academic session deleted."); refresh(); }, onError: failure("Unable to delete the session.") });
  const updateDepartment = useMutation({ mutationFn: academicService.updateDepartment, onSuccess: () => { toast.success("Department updated."); setEditDepartment(null); refresh(); }, onError: failure("Unable to update the department.") });
  const setDepartmentActive = useMutation({ mutationFn: academicService.setDepartmentActive, onSuccess: () => { toast.success("Department status updated."); refresh(); }, onError: failure("Unable to change department status.") });
  const deleteDepartment = useMutation({ mutationFn: academicService.deleteDepartment, onSuccess: () => { toast.success("Department deleted."); refresh(); }, onError: failure("Unable to delete the department.") });
  const updateProgramme = useMutation({ mutationFn: academicService.updateProgramme, onSuccess: () => { toast.success("Programme updated."); setEditProgramme(null); refresh(); }, onError: failure("Unable to update the programme.") });
  const setProgrammeActive = useMutation({ mutationFn: academicService.setProgrammeActive, onSuccess: () => { toast.success("Programme status updated."); refresh(); }, onError: failure("Unable to change programme status.") });
  const deleteProgramme = useMutation({ mutationFn: academicService.deleteProgramme, onSuccess: () => { toast.success("Programme deleted."); refresh(); }, onError: failure("Unable to delete the programme.") });

  const departments = structure.data ?? [];
  const programmeCount = departments.reduce((n, d) => n + d.programmes.length, 0);

  return <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="Academic Structure" subtitle="Maintain the Department → Programme/Cadre foundation used by student registration.">
    <section className="surface-card mb-6 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays className="size-5" /><h2 className="font-display text-lg font-bold">Academic sessions</h2></div><p className="mt-1 text-sm text-muted-foreground">Create and control the active/current academic session used by examinations and registrations.</p></div><Button className="tap-target rounded-xl" onClick={() => setSessionOpen(true)}><Plus className="size-4" /> Add session</Button></div>
      {sessions.isError ? <p className="mt-4 text-sm text-destructive">{sessions.error instanceof Error ? sessions.error.message : "Unable to load academic sessions."}</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{(sessions.data ?? []).map(s => <div key={s.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.start_date ?? "No start date"}{s.end_date ? ` → ${s.end_date}` : ""}</p></div><div className="flex gap-2">{s.is_current && <Badge>Current</Badge>}<Badge variant={s.is_active ? "secondary" : "outline"}>{s.is_active ? "Active" : "Inactive"}</Badge></div></div><div className="mt-3 flex flex-wrap gap-2">{!s.is_current && s.is_active && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setCurrent.mutate(s.id)} disabled={setCurrent.isPending}>Make current</Button>}{!s.is_current && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setActive.mutate({sessionId:s.id,active:!s.is_active})} disabled={setActive.isPending}>{s.is_active ? "Deactivate" : "Activate"}</Button>}<Button size="sm" variant="outline" className="rounded-lg" onClick={() => setEditSession(s)}><Pencil className="size-3.5" /> Edit</Button>{!s.is_current && <Button size="sm" variant="outline" className="rounded-lg text-destructive" disabled={deleteSession.isPending} onClick={() => { if (window.confirm(`Delete academic session ${s.name}? This cannot be undone.`)) deleteSession.mutate(s.id); }}><Trash2 className="size-3.5" /> Delete</Button>}</div></div>)}</div>}
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
      <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="rounded-xl bg-primary/10 p-2.5"><Building2 className="size-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display font-bold">{department.name}</h3><Badge variant="secondary">{department.code}</Badge>{!department.is_active && <Badge variant="outline">Inactive</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">Department</p></div></div><div className="flex shrink-0 flex-wrap justify-end gap-1.5"><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setProgrammeDepartment(department)}><Plus className="size-4" /> Programme</Button><Button size="sm" variant="outline" className="rounded-xl" aria-label="Edit department" onClick={() => setEditDepartment(department)}><Pencil className="size-4" /></Button><Button size="sm" variant="outline" className="rounded-xl" disabled={setDepartmentActive.isPending} onClick={() => setDepartmentActive.mutate({ departmentId: department.id, active: !department.is_active })}>{department.is_active ? "Deactivate" : "Activate"}</Button><Button size="sm" variant="outline" className="rounded-xl text-destructive" aria-label="Delete department" disabled={deleteDepartment.isPending} onClick={() => { if (window.confirm(`Delete department ${department.code} · ${department.name}? This cannot be undone.`)) deleteDepartment.mutate(department.id); }}><Trash2 className="size-4" /></Button></div></div>
      <div className="mt-5 space-y-2">{department.programmes.length ? department.programmes.map((programme) => <div key={programme.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="flex min-w-0 items-center gap-3"><GraduationCap className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{programme.name}</p><p className="text-xs text-muted-foreground">{programme.code}{programme.duration_years ? ` · ${programme.duration_years} years` : ""}</p></div></div><div className="flex shrink-0 items-center gap-1"><Badge variant={programme.is_active ? "secondary" : "outline"}>{programme.is_active ? "Active" : "Inactive"}</Badge><Button size="icon" variant="ghost" className="size-8" aria-label="Edit programme" onClick={() => setEditProgramme(programme)}><Pencil className="size-3.5" /></Button><Button size="icon" variant="ghost" className="size-8" aria-label={programme.is_active ? "Deactivate programme" : "Activate programme"} disabled={setProgrammeActive.isPending} onClick={() => setProgrammeActive.mutate({ programmeId: programme.id, active: !programme.is_active })}><Power className="size-3.5" /></Button><Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete programme" disabled={deleteProgramme.isPending} onClick={() => { if (window.confirm(`Delete programme ${programme.code} · ${programme.name}? This cannot be undone.`)) deleteProgramme.mutate(programme.id); }}><Trash2 className="size-3.5" /></Button></div></div>) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No programme/cadre has been added yet.</p>}</div>
    </Card>)}</div>}

    <AddSessionDialog open={sessionOpen} onOpenChange={setSessionOpen} pending={createSession.isPending} onSubmit={(v) => createSession.mutate(v)} />
    <AddDepartmentDialog open={departmentOpen} onOpenChange={setDepartmentOpen} pending={createDepartment.isPending} onSubmit={(v) => createDepartment.mutate(v)} />
    <EditSessionDialog session={editSession} onClose={() => setEditSession(null)} pending={updateSession.isPending} onSubmit={(v) => updateSession.mutate(v)} />
    <EditDepartmentDialog department={editDepartment} onClose={() => setEditDepartment(null)} pending={updateDepartment.isPending} onSubmit={(v) => updateDepartment.mutate(v)} />
    <EditProgrammeDialog programme={editProgramme} onClose={() => setEditProgramme(null)} pending={updateProgramme.isPending} onSubmit={(v) => updateProgramme.mutate(v)} />
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

function EditSessionDialog({ session, onClose, pending, onSubmit }: { session: AcademicSessionRecord | null; onClose: () => void; pending: boolean; onSubmit: (v: { sessionId: string; name: string; startDate: string | null; endDate: string | null }) => void }) {
  const [name, setName] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  useEffect(() => { if (session) { setName(session.name); setStart(session.start_date ?? ""); setEnd(session.end_date ?? ""); } }, [session]);
  return <Dialog open={Boolean(session)} onOpenChange={(v) => !v && onClose()}><DialogContent>
    <DialogHeader><DialogTitle>Edit academic session</DialogTitle><DialogDescription>Rename the session or change its dates. Examinations and registrations keep pointing at it.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="grid gap-2"><Label htmlFor="edit-session-name">Session name</Label><Input id="edit-session-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="edit-session-start">Start date</Label><Input id="edit-session-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="grid gap-2"><Label htmlFor="edit-session-end">End date</Label><Input id="edit-session-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !name.trim()} onClick={() => session && onSubmit({ sessionId: session.id, name, startDate: start || null, endDate: end || null })}>{pending ? "Saving…" : "Save changes"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function EditDepartmentDialog({ department, onClose, pending, onSubmit }: { department: DepartmentRecord | null; onClose: () => void; pending: boolean; onSubmit: (v: { departmentId: string; code: string; name: string }) => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  useEffect(() => { if (department) { setCode(department.code); setName(department.name); } }, [department]);
  return <Dialog open={Boolean(department)} onOpenChange={(v) => !v && onClose()}><DialogContent>
    <DialogHeader><DialogTitle>Edit department</DialogTitle><DialogDescription>Imports match departments by code, so update your import files if you change it.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="grid gap-2"><Label htmlFor="edit-dept-code">Department code</Label><Input id="edit-dept-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>
      <div className="grid gap-2"><Label htmlFor="edit-dept-name">Department name</Label><Input id="edit-dept-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !code.trim() || !name.trim()} onClick={() => department && onSubmit({ departmentId: department.id, code, name })}>{pending ? "Saving…" : "Save changes"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function EditProgrammeDialog({ programme, onClose, pending, onSubmit }: { programme: ProgrammeRecord | null; onClose: () => void; pending: boolean; onSubmit: (v: { programmeId: string; code: string; name: string; durationYears: number | null }) => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [duration, setDuration] = useState("");
  useEffect(() => { if (programme) { setCode(programme.code); setName(programme.name); setDuration(programme.duration_years ? String(programme.duration_years) : ""); } }, [programme]);
  const years = duration.trim() ? Number(duration) : null;
  const invalidYears = years !== null && (!Number.isInteger(years) || years <= 0);
  return <Dialog open={Boolean(programme)} onOpenChange={(v) => !v && onClose()}><DialogContent>
    <DialogHeader><DialogTitle>Edit programme / cadre</DialogTitle><DialogDescription>Imports match programmes by code within their department.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="grid gap-2"><Label htmlFor="edit-prog-code">Programme code</Label><Input id="edit-prog-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>
      <div className="grid gap-2"><Label htmlFor="edit-prog-name">Programme name</Label><Input id="edit-prog-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor="edit-prog-years">Duration (years, optional)</Label><Input id="edit-prog-years" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />{invalidYears ? <p className="text-xs text-destructive">Enter a whole number of years.</p> : null}</div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || invalidYears || !code.trim() || !name.trim()} onClick={() => programme && onSubmit({ programmeId: programme.id, code, name, durationYears: years })}>{pending ? "Saving…" : "Save changes"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

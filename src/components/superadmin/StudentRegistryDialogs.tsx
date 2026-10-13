import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { academicService } from "@/services/academic";
import { REGISTRATION_TYPES, studentAdminService } from "@/services/student-admin";

const fail = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);

/** Adds one student: department, programme (cadre), matric number, name and level. */
export function AddStudentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (student: { id: string; name: string }) => void;
}) {
  const structure = useQuery({ queryKey: ["academic-structure"], queryFn: () => academicService.listStructure(), enabled: open, retry: false });
  const [departmentId, setDepartmentId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [regNo, setRegNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState("");

  useEffect(() => {
    if (open) { setDepartmentId(""); setProgrammeId(""); setRegNo(""); setFullName(""); setLevel(""); }
  }, [open]);

  const departments = (structure.data ?? []).filter((d) => d.is_active);
  const programmes = (departments.find((d) => d.id === departmentId)?.programmes ?? []).filter((p) => p.is_active);
  const levelValue = level.trim() ? Number(level) : null;
  const levelInvalid = levelValue !== null && (!Number.isInteger(levelValue) || levelValue <= 0);
  const regInvalid = /\s/.test(regNo);

  const create = useMutation({
    mutationFn: () => studentAdminService.createStudent({ regNo: regNo.trim(), fullName: fullName.trim(), programmeId, level: levelValue }),
    onSuccess: (id) => { toast.success(`${fullName.trim()} was added.`); onCreated({ id, name: fullName.trim() }); },
    onError: fail("Unable to add the student."),
  });

  const ready = programmeId && regNo.trim() && fullName.trim().length >= 2 && !levelInvalid && !regInvalid;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription>Choose the department and cadre, then add the student's courses on the next screen.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setProgrammeId(""); }}>
                <SelectTrigger><SelectValue placeholder={structure.isPending ? "Loading…" : "Select department"} /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} · {d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Programme (cadre)</Label>
              <Select value={programmeId} onValueChange={setProgrammeId} disabled={!departmentId}>
                <SelectTrigger><SelectValue placeholder={departmentId ? "Select programme" : "Choose a department first"} /></SelectTrigger>
                <SelectContent>{programmes.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {structure.isError ? <p role="alert" className="text-sm text-destructive">{structure.error instanceof Error ? structure.error.message : "Could not load departments."}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="new-student-reg">Matriculation number</Label>
            <Input id="new-student-reg" value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="e.g. COHT/PT/2026/001" autoCapitalize="characters" />
            {regInvalid ? <p className="text-xs text-destructive">The matriculation number cannot contain spaces.</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-student-name">Full name</Label>
            <Input id="new-student-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-student-level">Level (optional)</Label>
            <Input id="new-student-level" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. 100" />
            {levelInvalid ? <p className="text-xs text-destructive">Enter a whole number.</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Adding…" : "Add student"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Registers one student for several courses at once, choosing from their department's courses. */
export function AddCoursesDialog({
  student,
  onClose,
  onSaved,
}: {
  student: { id: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = Boolean(student);
  const sessions = useQuery({ queryKey: ["academic-sessions"], queryFn: () => academicService.listSessions(), enabled: open, retry: false });
  const [sessionId, setSessionId] = useState("");
  const [type, setType] = useState("regular");
  const [allDepartments, setAllDepartments] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const activeSessions = (sessions.data ?? []).filter((s) => s.is_active);

  useEffect(() => {
    if (!student) return;
    setPicked(new Set()); setSearch(""); setType("regular"); setAllDepartments(false);
  }, [student?.id]);

  useEffect(() => {
    if (!student || sessionId || !activeSessions.length) return;
    setSessionId((activeSessions.find((s) => s.is_current) ?? activeSessions[0])!.id);
  }, [student, sessionId, activeSessions]);

  const courses = useQuery({
    queryKey: ["courses-for-student", student?.id, sessionId, allDepartments],
    queryFn: () => studentAdminService.listCoursesForStudent({ studentId: student!.id, sessionId: sessionId || null, allDepartments }),
    enabled: open && Boolean(sessionId),
    retry: false,
  });

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (courses.data ?? []).filter((c) => !needle || c.code.toLowerCase().includes(needle) || c.title.toLowerCase().includes(needle));
  }, [courses.data, search]);
  const selectable = shown.filter((c) => !c.alreadyRegistered);

  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allShownPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.courseId));

  const save = useMutation({
    mutationFn: () => studentAdminService.registerCourses({ studentId: student!.id, courseIds: [...picked], sessionId, registrationType: type }),
    onSuccess: ({ added, skipped }) => {
      toast.success(`${added} course${added === 1 ? "" : "s"} added${skipped ? `, ${skipped} already registered` : ""}.`);
      onSaved();
      onClose();
    },
    onError: fail("Unable to register the courses."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add courses{student ? ` for ${student.name}` : ""}</DialogTitle>
          <DialogDescription>Tick every course to register in one go. Courses already registered for the chosen session are greyed out.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Academic session</Label>
            <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setPicked(new Set()); }}>
              <SelectTrigger><SelectValue placeholder={sessions.isPending ? "Loading…" : "Select session"} /></SelectTrigger>
              <SelectContent>{activeSessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.is_current ? " · Current" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Registration type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REGISTRATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input className="min-w-48 flex-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or title" aria-label="Search courses" />
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={allDepartments} onCheckedChange={(v) => { setAllDepartments(Boolean(v)); setPicked(new Set()); }} /> Include other departments</label>
        </div>

        <div className="rounded-xl border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <button type="button" className="font-medium text-primary hover:underline disabled:opacity-50" disabled={!selectable.length}
              onClick={() => setPicked((prev) => { const next = new Set(prev); for (const c of selectable) { if (allShownPicked) next.delete(c.courseId); else next.add(c.courseId); } return next; })}>
              {allShownPicked ? "Clear shown" : "Select all shown"}
            </button>
            <span>{picked.size} selected</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {courses.isPending && sessionId ? <p className="p-4 text-sm text-muted-foreground">Loading courses…</p> : null}
            {courses.isError ? <p role="alert" className="p-4 text-sm text-destructive">{courses.error instanceof Error ? courses.error.message : "Could not load courses."}</p> : null}
            {courses.isSuccess && !shown.length ? <p className="p-4 text-sm text-muted-foreground">No courses to show.</p> : null}
            {shown.map((c) => (
              <label key={c.courseId} className={`flex items-start gap-3 border-b px-3 py-2 text-sm last:border-b-0 ${c.alreadyRegistered ? "opacity-50" : "cursor-pointer hover:bg-secondary/50"}`}>
                <Checkbox className="mt-0.5" disabled={c.alreadyRegistered} checked={c.alreadyRegistered || picked.has(c.courseId)} onCheckedChange={() => toggle(c.courseId)} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.code}</span> · {c.title}
                  <span className="block text-xs text-muted-foreground">
                    {[c.level ? `Level ${c.level}` : null, c.semester ? `Semester ${c.semester}` : null, c.creditUnits ? `${c.creditUnits} unit${c.creditUnits === 1 ? "" : "s"}` : null, c.programmeCode, !c.matchesProgramme && c.departmentCode ? c.departmentCode : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {c.alreadyRegistered ? <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">Registered</span> : null}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!picked.size || !sessionId || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : `Add ${picked.size || ""} course${picked.size === 1 ? "" : "s"}`.replace("  ", " ")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, LockKeyhole, MailCheck, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { supervisionService, systemService } from "@/services";
import { examManagementService } from "@/services/exam-management";
import { resultMailService } from "@/services/result-mail";

export const Route = createFileRoute("/superadmin/settings")({ component: SettingsPage });

const ALL_PAPERS = "all";
const QUICK_MINUTES = [5, 10, 15, 30];

function SettingsPage() {
  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="System settings"
      subtitle="Protected controls for examination behaviour and supervision."
    >
      <section>
        <SectionHeader
          title="Result sheet mailing"
          description="When an examination is closed, each paper's examiner is emailed an Excel and a Word result sheet."
        />
        <div className="mt-4">
          <ResultMailCard />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Protected actions" description="These actions remain SuperAdmin-only." />
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TimeExtensionCard />
          <StrikeRecoveryCard />
          <IdentityOverridesCard />
        </div>
      </section>
    </RoleShell>
  );
}

function TimeExtensionCard() {
  const qc = useQueryClient();
  const exams = useQuery({
    queryKey: ["superadmin-papers"],
    queryFn: () => examManagementService.list(),
    retry: false,
  });
  const [examId, setExamId] = useState("");
  const [paperId, setPaperId] = useState(ALL_PAPERS);
  const [minutes, setMinutes] = useState("10");
  const [reason, setReason] = useState("");

  const list = (exams.data ?? []) as any[];
  const exam = list.find((e) => e.id === examId) ?? null;
  const papers: any[] = exam?.courses ?? [];
  const amount = Number(minutes);
  const invalid = !examId || !Number.isInteger(amount) || amount < 1 || amount > 240;

  const extend = useMutation({
    mutationFn: () =>
      systemService.extendExamTimeBulk({
        examId,
        ...(paperId !== ALL_PAPERS ? { examCourseId: paperId } : {}),
        minutes: amount,
        reason,
      }),
    onSuccess: (count) => {
      if (count === 0) toast.info("No candidates are currently sitting this examination.");
      else toast.success(`Added ${amount} minute${amount === 1 ? "" : "s"} for ${count} candidate${count === 1 ? "" : "s"}.`);
      setReason("");
      qc.invalidateQueries({ queryKey: ["supervision"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to extend time."),
  });

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex gap-3">
        <TimerReset className="size-5" />
        <div>
          <p className="font-semibold">Time extensions</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add time for every candidate currently sitting an examination, for example after a power outage. To extend one
            candidate, use Live monitoring.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <Label>Examination</Label>
          <Select value={examId} onValueChange={(v) => { setExamId(v); setPaperId(ALL_PAPERS); }}>
            <SelectTrigger><SelectValue placeholder={exams.isPending ? "Loading examinations…" : "Select examination"} /></SelectTrigger>
            <SelectContent>
              {list.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}{e.is_active ? " · Live" : " · Inactive"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {exams.isError ? <p className="text-sm text-destructive">{exams.error instanceof Error ? exams.error.message : "Could not load examinations."}</p> : null}
        </div>

        {papers.length > 1 ? (
          <div className="grid gap-2">
            <Label>Paper</Label>
            <Select value={paperId} onValueChange={setPaperId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PAPERS}>All papers</SelectItem>
                {papers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.courses?.code ?? "Course"} · {p.courses?.title ?? ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="bulk-minutes">Minutes to add</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input id="bulk-minutes" className="w-28" type="number" min="1" max="240" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            {QUICK_MINUTES.map((m) => (
              <Button key={m} type="button" size="sm" variant={amount === m ? "default" : "outline"} className="rounded-lg" onClick={() => setMinutes(String(m))}>+{m}</Button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bulk-reason">Reason (recorded in the audit trail)</Label>
          <Input id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Power outage in the examination hall" />
        </div>

        <Button
          className="justify-self-start rounded-xl"
          disabled={invalid || extend.isPending}
          onClick={() => {
            const scope = paperId === ALL_PAPERS ? exam?.title : `${exam?.title} (selected paper)`;
            if (window.confirm(`Add ${amount} minute(s) for every candidate currently sitting ${scope}?`)) extend.mutate();
          }}
        >
          {extend.isPending ? "Applying…" : "Apply extension"}
        </Button>
      </div>
    </div>
  );
}

function StrikeRecoveryCard() {
  const qc = useQueryClient();
  const attempts = useQuery({
    queryKey: ["supervision", "active"],
    queryFn: () => supervisionService.listActiveAttempts(),
    retry: false,
  });
  const [attemptId, setAttemptId] = useState("");
  const [note, setNote] = useState("");
  const [resume, setResume] = useState(true);

  const flagged = useMemo(
    () => (attempts.data ?? []).filter((a) => a.strikes > 0 || a.status === "paused"),
    [attempts.data],
  );
  const selected = flagged.find((a) => a.attemptId === attemptId) ?? null;

  const recover = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a candidate first.");
      const cleared = await systemService.clearStrikes({ attemptId: selected.attemptId, note: note.trim() });
      let resumed = false;
      if (resume && selected.status === "paused") {
        await supervisionService.applyAction({ attemptId: selected.attemptId, action: "resume", note: note.trim() });
        resumed = true;
      }
      return { cleared, resumed };
    },
    onSuccess: ({ cleared, resumed }) => {
      toast.success(`Cleared ${cleared} strike${cleared === 1 ? "" : "s"}${resumed ? " and resumed the paper" : ""}.`);
      setAttemptId("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["supervision"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to clear strikes."),
  });

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex gap-3">
        <LockKeyhole className="size-5" />
        <div>
          <p className="font-semibold">Strike recovery</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear the integrity strikes of a candidate who was paused unfairly, and optionally resume their paper. The action
            and your reason are recorded in the audit trail.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <Label>Candidate</Label>
          <Select value={attemptId} onValueChange={setAttemptId}>
            <SelectTrigger>
              <SelectValue placeholder={attempts.isPending ? "Loading candidates…" : flagged.length ? "Select candidate" : "No candidate has strikes right now"} />
            </SelectTrigger>
            <SelectContent>
              {flagged.map((a) => (
                <SelectItem key={a.attemptId} value={a.attemptId}>
                  {a.student.fullName} · {a.student.matricNumber} · {a.strikes} strike{a.strikes === 1 ? "" : "s"}{a.status === "paused" ? " · Paused" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {attempts.isError ? <p className="text-sm text-destructive">{attempts.error instanceof Error ? attempts.error.message : "Could not load candidates."}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="strike-note">Reason</Label>
          <Input id="strike-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are the strikes being cleared?" />
        </div>

        {selected?.status === "paused" ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={resume} onCheckedChange={(v) => setResume(Boolean(v))} /> Also resume the paused paper
          </label>
        ) : null}

        <Button
          className="justify-self-start rounded-xl"
          disabled={!selected || note.trim().length < 3 || recover.isPending}
          onClick={() => recover.mutate()}
        >
          {recover.isPending ? "Working…" : "Clear strikes"}
        </Button>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  sending: "bg-blue-100 text-blue-900",
  sent: "bg-emerald-100 text-emerald-900",
  failed: "bg-red-100 text-red-900",
};

function ResultMailCard() {
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ["result-mail-queue"], queryFn: () => resultMailService.listQueue(30), retry: false });
  const [testTo, setTestTo] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["result-mail-queue"] });
  const fail = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);

  const sendPending = useMutation({
    mutationFn: () => resultMailService.sendPending(),
    onSuccess: (r) => {
      if (!r.processed) toast.info("Nothing is waiting to be sent.");
      else if (r.failed) toast.warning(`${r.sent} sent, ${r.failed} failed: ${r.failures[0]?.error ?? ""}`, { duration: 12000 });
      else toast.success(`Sent ${r.sent} result sheet${r.sent === 1 ? "" : "s"}.`);
      refresh();
    },
    onError: fail("Unable to send result sheets."),
  });
  const retry = useMutation({
    mutationFn: async (id: string) => { await resultMailService.retry(id); return resultMailService.sendPending(); },
    onSuccess: (r) => {
      if (r.failed) toast.warning(`Still failing: ${r.failures[0]?.error ?? "see the queue"}`, { duration: 12000 });
      else toast.success("Result sheet sent.");
      refresh();
    },
    onError: fail("Unable to retry."),
  });
  const sendTest = useMutation({
    mutationFn: () => resultMailService.sendTest(testTo.trim()),
    onSuccess: () => toast.success("Test email sent. Check the inbox (and spam) for the sample sheet."),
    onError: fail("The test email could not be sent."),
  });

  const rows = queue.data ?? [];
  const waiting = rows.filter((r) => r.status === "pending" || r.status === "sending").length;

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex gap-3">
        <MailCheck className="mt-0.5 size-5" />
        <div>
          <p className="font-semibold">Delivery queue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Set the examiner email on each paper in Examinations → Edit. Closing the examination queues the sheets and sends them.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button className="rounded-xl" disabled={sendPending.isPending || waiting === 0} onClick={() => sendPending.mutate()}>
          {sendPending.isPending ? "Sending…" : `Send pending now${waiting ? ` (${waiting})` : ""}`}
        </Button>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input className="min-w-56 flex-1" type="email" placeholder="Send a test email to…" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Button variant="outline" className="rounded-xl" disabled={!testTo.includes("@") || sendTest.isPending} onClick={() => sendTest.mutate()}>
            {sendTest.isPending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {queue.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {queue.isError ? <p role="alert" className="text-sm text-destructive">{queue.error instanceof Error ? queue.error.message : "Could not load the queue."}</p> : null}
        {queue.isSuccess && !rows.length ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No result sheets have been queued yet.</p> : null}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate"><b>{r.courseCode}</b> · {r.courseTitle} <span className="text-muted-foreground">({r.examTitle})</span></p>
              <p className="truncate text-xs text-muted-foreground">{r.recipients}{r.lastError ? ` · ${r.lastError}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
              {r.status === "failed" ? (
                <Button size="sm" variant="outline" className="rounded-lg" disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>Retry</Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdentityOverridesCard() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const requests = useQuery({ queryKey: ["photo-requests"], queryFn: () => systemService.listPhotoRequests(), retry: false });
  const found = useQuery({
    queryKey: ["student-identity", submitted],
    queryFn: () => systemService.findStudentIdentity(submitted),
    enabled: submitted.trim().length >= 2,
    retry: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["photo-requests"] });
    qc.invalidateQueries({ queryKey: ["student-identity"] });
  };
  const fail = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);

  const decide = useMutation({
    mutationFn: (input: { requestId: string; approve: boolean }) => systemService.decidePhotoRequest(input),
    onSuccess: (_d, v) => { toast.success(v.approve ? "Approved. The student can upload one more photo." : "Request declined."); refresh(); },
    onError: fail("Unable to record the decision."),
  });
  const grant = useMutation({
    mutationFn: (studentId: string) => systemService.grantPhotoChange(studentId),
    onSuccess: () => { toast.success("The student can upload one more photo."); refresh(); },
    onError: fail("Unable to allow another upload."),
  });
  const release = useMutation({
    mutationFn: (studentId: string) => systemService.releaseStudentDevice(studentId),
    onSuccess: () => { toast.success("Device released. The student can sign in on another device."); refresh(); },
    onError: fail("Unable to release the device."),
  });

  const pending = requests.data ?? [];

  return (
    <div className="rounded-2xl border p-5 xl:col-span-2">
      <div className="flex gap-3">
        <Fingerprint className="mt-0.5 size-5" />
        <div>
          <p className="font-semibold">Identity and device overrides</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A student may change their identifier photo once. After that, approve another upload here. A registration number can be
            active on one device at a time; release it here if a student's device died or was lost.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">Photo change requests</p>
          <div className="mt-2 grid gap-2">
            {requests.isError ? <p role="alert" className="text-sm text-destructive">{requests.error instanceof Error ? requests.error.message : "Could not load requests."}</p> : null}
            {requests.isSuccess && !pending.length ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No requests waiting.</p> : null}
            {pending.map((r) => (
              <div key={r.requestId} className="rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                <p><b>{r.fullName}</b> · {r.matricNumber}</p>
                {r.reason ? <p className="text-xs text-muted-foreground">{r.reason}</p> : null}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="rounded-lg" disabled={decide.isPending} onClick={() => decide.mutate({ requestId: r.requestId, approve: true })}>Allow one more upload</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={decide.isPending} onClick={() => decide.mutate({ requestId: r.requestId, approve: false })}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Find a student</p>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(term.trim()); }}>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Matric number or name" />
            <Button type="submit" variant="outline" className="rounded-xl" disabled={term.trim().length < 2}>Search</Button>
          </form>
          <div className="mt-2 grid gap-2">
            {found.isFetching ? <p className="text-sm text-muted-foreground">Searching…</p> : null}
            {found.isError ? <p role="alert" className="text-sm text-destructive">{found.error instanceof Error ? found.error.message : "Search failed."}</p> : null}
            {found.isSuccess && !found.data.length ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No matching student.</p> : null}
            {(found.data ?? []).map((st) => (
              <div key={st.studentId} className="rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                <p><b>{st.fullName}</b> · {st.matricNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Photo: {st.hasPhoto ? `${st.photoUploads} upload${st.photoUploads === 1 ? "" : "s"}, ${st.photoCanUpload ? "can still change it" : "locked"}` : "not uploaded yet"}
                  {" · "}
                  Device: {st.deviceActive ? `active on ${st.deviceLabel ?? "a device"}` : st.deviceLabel ? `last on ${st.deviceLabel} (inactive)` : "none"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={!st.hasPhoto || st.photoCanUpload || grant.isPending} onClick={() => grant.mutate(st.studentId)}>Allow another photo upload</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={!st.deviceLabel && !st.deviceActive || release.isPending} onClick={() => release.mutate(st.studentId)}>Release device</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

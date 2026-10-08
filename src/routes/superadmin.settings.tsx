import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, LockKeyhole, MailCheck, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { supervisionService, systemService } from "@/services";
import { examManagementService } from "@/services/exam-management";

export const Route = createFileRoute("/superadmin/settings")({ component: SettingsPage });

const ALL_PAPERS = "all";
const QUICK_MINUTES = [5, 10, 15, 30];

function SettingsPage() {
  const [instantResults, setInstantResults] = useState(false);
  const [mailing, setMailing] = useState(false);

  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="System settings"
      subtitle="Protected controls for examination behaviour and supervision."
    >
      <section>
        <SectionHeader
          title="Student result visibility"
          description="Control whether eligible students can see their result immediately after submission."
        />
        <div className="mt-4 flex items-center justify-between rounded-2xl border p-5">
          <div className="flex gap-3">
            <Eye className="mt-0.5 size-5" />
            <Label className="text-base">Allow instant result viewing</Label>
          </div>
          <Switch checked={instantResults} onCheckedChange={setInstantResults} />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Result mailing" description="Authorize release of results by email after an examination." />
        <div className="mt-4 flex items-center justify-between rounded-2xl border p-5">
          <div className="flex gap-3">
            <MailCheck className="mt-0.5 size-5" />
            <Label className="text-base">Authorize result mailing</Label>
          </div>
          <Switch checked={mailing} onCheckedChange={setMailing} />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Protected actions" description="These actions remain SuperAdmin-only." />
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TimeExtensionCard />
          <StrikeRecoveryCard />
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

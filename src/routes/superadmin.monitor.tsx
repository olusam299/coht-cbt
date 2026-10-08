import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RoleShell, SectionHeader } from "@/components/layout/RoleShell";
import { SUPERADMIN_NAV } from "@/components/layout/nav-config";
import { MonitorStudentCard } from "@/components/admin/MonitorStudentCard";
import { ServiceState } from "@/components/ServiceState";
import { supervisionService, systemService } from "@/services";
import { sortByAttention, type MonitoredAttempt, type SupervisorAction } from "@/lib/exam-security";

export const Route = createFileRoute("/superadmin/monitor")({
  head: () => ({
    meta: [
      { title: "Monitor Papers | COHT CBT SuperAdmin" },
      {
        name: "description",
        content:
          "Live grid of every candidate writing across the institution with resume, pause, wipe, force submit and cancel controls.",
      },
      { property: "og:title", content: "Monitor Papers | COHT CBT SuperAdmin" },
      {
        property: "og:description",
        content: "Institution-wide live candidate monitoring and supervisor interventions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminMonitor,
});

const ALL_ACTIONS: SupervisorAction[] = [
  "resume",
  "pause",
  "wipe-for-restart",
  "force-submit",
  "cancel-paper",
];

function SuperAdminMonitor() {
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [extensionTarget, setExtensionTarget] = useState<MonitoredAttempt | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [extensionNote, setExtensionNote] = useState("");

  const attempts = useQuery({
    queryKey: ["supervision", "active"],
    queryFn: () => supervisionService.listActiveAttempts(),
    retry: false,
  });

  // Backstop for papers left open after a browser closes. The database also runs
  // this every minute when pg_cron is enabled; this keeps it working without it.
  const refetchAttempts = attempts.refetch;
  useEffect(() => {
    let stopped = false;
    const sweep = async () => {
      try {
        const submitted = await systemService.sweepExpiredPapers();
        if (!stopped && submitted > 0) {
          toast.info(`${submitted} expired paper${submitted === 1 ? " was" : "s were"} submitted automatically.`);
          void refetchAttempts();
        }
      } catch {
        // Not fatal: the scheduled database job may already be handling expiry.
      }
    };
    void sweep();
    const id = window.setInterval(() => void sweep(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [refetchAttempts]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = sortByAttention(attempts.data ?? []);
    if (!needle) return list;
    return list.filter(
      (a) =>
        a.student.fullName.toLowerCase().includes(needle) ||
        a.student.matricNumber.toLowerCase().includes(needle) ||
        a.courseCode.toLowerCase().includes(needle),
    );
  }, [attempts.data, term]);

  async function apply(attemptId: string, action: SupervisorAction) {
    setBusy(attemptId);
    try {
      await supervisionService.applyAction({ attemptId, action });
      await attempts.refetch();
      toast.success("Intervention applied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }


  async function addTime(minutes: number) {
    if (!extensionTarget) return;
    setBusy(extensionTarget.attemptId);
    try {
      await systemService.addTimeExtension({
        attemptId: extensionTarget.attemptId,
        minutes,
        ...(extensionNote.trim() ? { note: extensionNote.trim() } : {}),
      });
      await attempts.refetch();
      toast.success(`${minutes} minutes added to ${extensionTarget.student.fullName}`);
      setExtensionTarget(null);
      setCustomMinutes("");
      setExtensionNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add time");
    } finally {
      setBusy(null);
    }
  }

  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="Monitor papers"
      subtitle="Cancelling a paper locks the candidate out for the day and never submits it"
    >
      <SectionHeader
        title="Live candidates"
        description="Identity photos are enlarged here so supervisors can recognise candidates at a glance."
        actions={
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search name, matric or course"
            className="tap-target w-full rounded-xl sm:w-72"
            aria-label="Search candidates"
          />
        }
      />
      <ServiceState
        query={attempts}
        emptyTitle="No active sittings"
        emptyDescription="Candidates appear here as soon as a paper goes live."
      >
        {() => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((attempt) => (
              <MonitorStudentCard
                key={attempt.attemptId}
                attempt={attempt}
                avatarSize="xl"
                actions={ALL_ACTIONS}
                busy={busy === attempt.attemptId}
                onAction={(action) => apply(attempt.attemptId, action)}
                onAddTime={() => setExtensionTarget(attempt)}
              />
            ))}
          </div>
        )}
      </ServiceState>

      <Dialog open={Boolean(extensionTarget)} onOpenChange={(open) => !open && setExtensionTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add examination time</DialogTitle>
            <DialogDescription>
              {extensionTarget ? `${extensionTarget.student.fullName} · ${extensionTarget.courseCode}` : "Select a candidate"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[5, 10, 15, 30].map((minutes) => (
              <Button key={minutes} variant="outline" className="rounded-xl" disabled={busy !== null} onClick={() => addTime(minutes)}>+{minutes} min</Button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="custom-extension">Custom minutes</label>
            <div className="flex gap-2">
              <Input id="custom-extension" type="number" min="1" max="240" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} placeholder="e.g. 12" />
              <Button variant="outline" disabled={!customMinutes || busy !== null} onClick={() => addTime(Number(customMinutes))}>Add</Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="extension-note">Reason / note</label>
            <Textarea id="extension-note" value={extensionNote} onChange={(event) => setExtensionNote(event.target.value)} placeholder="Record why extra time is being granted" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtensionTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}

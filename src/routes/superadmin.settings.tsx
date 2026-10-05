import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Eye, Gauge, LockKeyhole, MailCheck, TimerReset } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RoleShell, SectionHeader } from '@/components/layout/RoleShell';
import { SUPERADMIN_NAV } from '@/components/layout/nav-config';
import { systemService, type ExamMode } from '@/services';

export const Route=createFileRoute('/superadmin/settings')({component: SettingsPage});
function SettingsPage(){
 const [mode, setSelectedMode] = useState<ExamMode>('live'); const [instantResults,setInstantResults]=useState(false); const [mailing,setMailing]=useState(false);
 const modeMutation=useMutation({mutationFn:(m:ExamMode)=>systemService.setExamMode(m)});
 const selectMode=(m: ExamMode) => { setSelectedMode(m); modeMutation.mutate(m); };
 return <RoleShell role="superadmin" items={SUPERADMIN_NAV} title="System settings" subtitle="Protected controls for examination behaviour and supervision.">
  <section><SectionHeader title="Examination mode" description="Choose the current operational mode. Backend enforcement will replace this demo state." />
   <div className="mt-4 grid gap-3 md:grid-cols-3">{([['live','Regular'],['practice','Continuous'],['locked','Pharmacy Pre-National']] as const).map(([value,label])=><button key={value} onClick={()=>selectMode(value)} className={`rounded-2xl border p-5 text-left transition ${mode===value?'border-primary ring-2 ring-primary/20':'hover:bg-muted/40'}`}><Gauge className="size-5 mb-3"/><p className="font-semibold">{label}</p><p className="mt-1 text-sm text-muted-foreground">{value==='live'?'Submission follows normal paper completion.':value==='practice'?'Return to dashboard without changing OTP flow.':'Supports multi-course examination sessions.'}</p></button>)}</div>
  </section>
  <section className="mt-8"><SectionHeader title="Student result visibility" description="Control whether eligible students can see their result immediately after submission." />
   <div className="mt-4 flex items-center justify-between rounded-2xl border p-5"><div className="flex gap-3"><Eye className="size-5 mt-0.5"/><div><Label className="text-base">Allow instant result viewing</Label><p className="mt-1 text-sm text-muted-foreground">This will later be enforced per examination by the backend.</p></div></div><Switch checked={instantResults} onCheckedChange={setInstantResults}/></div>
  </section>
  <section className="mt-8"><SectionHeader title="Result mailing" description="Authorize release of results by email after an examination." />
   <div className="mt-4 flex items-center justify-between rounded-2xl border p-5"><div className="flex gap-3"><MailCheck className="size-5 mt-0.5"/><div><Label className="text-base">Authorize result mailing</Label><p className="mt-1 text-sm text-muted-foreground">This demo switch represents SuperAdmin authorization.</p></div></div><Switch checked={mailing} onCheckedChange={setMailing}/></div>
  </section>
  <section className="mt-8"><SectionHeader title="Protected actions" description="These actions remain SuperAdmin-only." />
   <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border p-5"><div className="flex gap-3"><TimerReset className="size-5"/><div><p className="font-semibold">Time extensions</p><p className="mt-1 text-sm text-muted-foreground">Available from the live monitoring workflow for individual attempts.</p></div></div></div><div className="rounded-2xl border p-5"><div className="flex gap-3"><LockKeyhole className="size-5"/><div><p className="font-semibold">Identity and security overrides</p><p className="mt-1 text-sm text-muted-foreground">Photo-change clearance and exceptional strike recovery remain privileged actions.</p></div></div></div></div>
  </section>
 </RoleShell>
}

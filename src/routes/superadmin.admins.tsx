import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleShell, SectionHeader, StatTile } from '@/components/layout/RoleShell';
import { SUPERADMIN_NAV } from '@/components/layout/nav-config';
import { ServiceState } from '@/components/ServiceState';
import { systemService } from '@/services';
import { useState } from 'react';

export const Route = createFileRoute('/superadmin/admins')({ component: AdminManagement });

function AdminManagement() {
  const qc = useQueryClient();
  const admins = useQuery({
    queryKey: ['system', 'admins'],
    queryFn: () => systemService.listAdmins(),
    retry: false,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['system', 'admins'] });

  const create = useMutation({
    mutationFn: () =>
      systemService.createAdmin({
        fullName: fullName.trim(),
        email: email.trim(),
        password: initialPassword,
      }),
    onSuccess: () => {
      setFullName('');
      setEmail('');
      setInitialPassword('');
      setCreateError(null);
      setShowCreate(false);
      refresh();
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : 'Unable to create administrator.');
    },
  });

  const toggle = useMutation({
    mutationFn: (x: { id: string; active: boolean }) =>
      systemService.setAdminActive({ adminId: x.id, active: x.active }),
    onSuccess: refresh,
  });

  const reset = useMutation({
    mutationFn: () =>
      systemService.changeAdminPassword({
        adminId: passwordFor!,
        password,
      }),
    onSuccess: () => {
      setPassword('');
      setPasswordFor(null);
    },
  });

  const list = admins.data ?? [];

  return (
    <RoleShell
      role="superadmin"
      items={SUPERADMIN_NAV}
      title="Admin management"
      subtitle="Create, activate, deactivate and secure examination administrator accounts."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Total admins" value={String(list.length)} />
        <StatTile label="Active" value={String(list.filter((a) => a.active).length)} tone="success" />
        <StatTile label="Inactive" value={String(list.filter((a) => !a.active).length)} tone="warning" />
      </div>

      <section className="mt-8">
        <SectionHeader
          title="Administrators"
          description="Administrative accounts are real Supabase Auth users. Admins do not receive result access."
        />

        {!showCreate ? (
          <Button className="mt-4 rounded-xl" onClick={() => { setCreateError(null); setShowCreate(true); }}>
            <UserPlus className="size-4" />
            Create administrator
          </Button>
        ) : (
          <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Create administrator account</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This creates a real Supabase Auth account and its application profile.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="admin-full-name">Full name</Label>
                <Input
                  id="admin-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Administrator full name"
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-email">Administrative email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu.ng"
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-initial-password">Initial password</Label>
                <Input
                  id="admin-initial-password"
                  type="password"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {createError ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {createError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end">
              <Button
                className="rounded-xl"
                onClick={() => create.mutate()}
                disabled={
                  create.isPending ||
                  fullName.trim().length < 2 ||
                  !email.includes('@') ||
                  initialPassword.length < 8
                }
              >
                {create.isPending ? 'Creating…' : 'Create administrator'}
              </Button>
            </div>
          </div>
        )}

        <ServiceState query={admins} emptyTitle="No administrators" emptyDescription="Administrator accounts will appear here.">
          {() => (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {list.map((a) => (
                <div key={a.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        <UserCog className="size-4" />
                        {a.fullName}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{a.email}</p>
                    </div>
                    <Switch
                      checked={a.active}
                      onCheckedChange={(active) => toggle.mutate({ id: a.id, active })}
                      aria-label={`Toggle ${a.fullName}`}
                      disabled={toggle.isPending}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-muted-foreground">Assigned papers</p>
                      <p className="mt-1 font-semibold">{a.assignedPapers}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-muted-foreground">Status</p>
                      <p className="mt-1 font-semibold">{a.active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>

                  {passwordFor === a.id ? (
                    <div className="mt-4 space-y-2 rounded-xl border p-3">
                      <Label htmlFor={`password-${a.id}`}>New password</Label>
                      <Input
                        id={`password-${a.id}`}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                      />
                      {reset.error ? (
                        <p className="text-sm text-destructive">
                          {reset.error instanceof Error ? reset.error.message : 'Unable to change password.'}
                        </p>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => reset.mutate()}
                          disabled={password.length < 8 || reset.isPending}
                        >
                          {reset.isPending ? 'Saving…' : 'Save password'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setPasswordFor(null); setPassword(''); reset.reset(); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-4 rounded-xl"
                      onClick={() => { setPasswordFor(a.id); reset.reset(); }}
                    >
                      <KeyRound className="size-4" />
                      Change password
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ServiceState>
      </section>

      <div className="mt-6 flex gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0" />
        <span>
          Account creation and password changes are performed through a protected server-side function.
          The browser never receives the Supabase service-role key.
        </span>
      </div>
    </RoleShell>
  );
}

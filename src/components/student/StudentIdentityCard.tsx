import { Link } from "@tanstack/react-router";
import { Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { firstNameOf, greetingFor, type StudentProfile } from "@/lib/student-profile";

/**
 * Time-sensitive greeting + identity block at the top of the student portal.
 * Falls back to a neutral, honest shell while the profile is loading or the
 * backend is unavailable — never invented student data.
 */
export function StudentIdentityCard({
  profile,
  loading,
  now = new Date(),
}: {
  profile: StudentProfile | null;
  loading?: boolean;
  now?: Date;
}) {
  if (loading) {
    return (
      <section className="surface-card flex items-center gap-4 rounded-2xl p-5">
        <Skeleton className="size-14 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </section>
    );
  }

  const hour = now.getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (!profile) {
    return (
      <section className="surface-card grid gap-3 rounded-2xl p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl">{part}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your matriculation number to see your papers and identity photo.
          </p>
        </div>
        <Button asChild className="tap-target rounded-xl">
          <Link to="/auth">Sign in</Link>
        </Button>
      </section>
    );
  }

  const needsPhoto = !profile.photoUrl || !profile.onboardingComplete;

  return (
    <section className="surface-card grid gap-4 rounded-2xl p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <StudentAvatar
        name={profile.fullName}
        photoUrl={profile.photoUrl}
        gender={profile.gender}
        size="xl"
      />
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-bold sm:text-2xl">
          {greetingFor(now, firstNameOf(profile.fullName))}
        </h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {profile.matricNumber}
          {profile.programme ? ` · ${profile.programme}` : ""}
          {profile.level ? ` · ${profile.level}` : ""}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          Your identifier photo is shown to invigilators during every sitting.
        </p>
      </div>
      <Button
        asChild
        variant={needsPhoto ? "default" : "outline"}
        className="tap-target rounded-xl"
      >
        <Link to="/onboarding">
          <Camera className="size-4" aria-hidden />
          {needsPhoto ? "Add your photo" : "Identity"}
        </Link>
      </Button>
    </section>
  );
}
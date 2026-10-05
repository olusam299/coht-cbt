import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Lock, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PortalHeader } from "@/components/PortalHeader";
import { StudentAvatar } from "@/components/StudentAvatar";
import { LoadingState } from "@/components/states";
import { NotConnectedState } from "@/components/ServiceState";
import { profileService, BackendNotConnectedError } from "@/services";
import { formatBytes, processIdentifierPhoto } from "@/lib/image-utils";
import {
  GENDER_LABELS,
  canChangePhoto,
  type Gender,
  type StudentProfile,
} from "@/lib/student-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set your identifier photo | COHT CBT Portal" },
      {
        name: "description",
        content:
          "One-time student identity setup: upload a clear selfie and confirm your details for exam invigilation.",
      },
      { property: "og:title", content: "Set your identifier photo | COHT CBT Portal" },
      {
        property: "og:description",
        content: "Complete your College of Health CBT identity onboarding before your first paper.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [preview, setPreview] = useState<{ dataUrl: string; blob: Blob; bytes: number } | null>(
    null,
  );
  const [processing, setProcessing] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.getMyProfile(),
    retry: false,
  });
  const profile: StudentProfile | null = profileQuery.data ?? null;

  const upload = useMutation({
    mutationFn: async () => {
      if (!preview || !gender) throw new Error("Choose a photo and your gender first.");
      return profileService.uploadIdentifierPhoto({ blob: preview.blob, gender });
    },
    onSuccess: () => {
      toast.success("Identifier photo saved");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void navigate({ to: "/" });
    },
    onError: (error) =>
      toast.error(
        error instanceof BackendNotConnectedError
          ? "Photo upload is not connected to the examination server yet."
          : error instanceof Error
            ? error.message
            : "Upload failed",
      ),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    try {
      const processed = await processIdentifierPhoto(file);
      setPreview({ dataUrl: processed.dataUrl, blob: processed.blob, bytes: processed.bytes });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that image.");
    } finally {
      setProcessing(false);
    }
  }

  const locked = profile ? !canChangePhoto(profile) : false;
  const ready = Boolean(preview && gender) && !locked;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader
        actions={
          <Button asChild variant="ghost" className="tap-target rounded-xl">
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden /> Dashboard
            </Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="animate-rise">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Your identifier photo</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Invigilators use this photo to confirm it is really you sitting the paper. Take a
            clear, front-facing selfie in good light. We crop it to a small square and never keep
            the camera original.
          </p>
        </div>

        {profileQuery.isPending ? (
          <div className="mt-8">
            <LoadingState label="Loading your profile" />
          </div>
        ) : (
          <div className="mt-8 grid gap-5">
            {profileQuery.isError ? (
              <NotConnectedState
                operation={
                  profileQuery.error instanceof Error
                    ? profileQuery.error.message
                    : "profile.getMyProfile"
                }
                description="You can still prepare your photo below; it will be saved once the examination server is connected."
                onRetry={() => profileQuery.refetch()}
              />
            ) : null}

            <section className="surface-card grid gap-6 rounded-2xl p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
              <div className="flex flex-col items-center gap-3">
                <StudentAvatar
                  name={profile?.fullName ?? "Student"}
                  photoUrl={preview?.dataUrl ?? profile?.photoUrl ?? null}
                  gender={gender ?? profile?.gender ?? null}
                  size="xl"
                  className="scale-[1.6] py-6"
                />
                {preview ? (
                  <p className="text-xs text-muted-foreground">
                    320px square · {formatBytes(preview.bytes)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-5">
                <div>
                  <h2 className="text-sm font-semibold">1. Choose your photo</h2>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="sr-only"
                    onChange={(event) => {
                      void handleFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="tap-target rounded-xl"
                      disabled={processing || locked}
                      onClick={() => fileRef.current?.click()}
                    >
                      {preview ? (
                        <RefreshCw className="size-4" aria-hidden />
                      ) : (
                        <Camera className="size-4" aria-hidden />
                      )}
                      {processing ? "Preparing…" : preview ? "Retake / replace" : "Take or upload"}
                    </Button>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold">2. Confirm your gender</h2>
                  <div
                    role="radiogroup"
                    aria-label="Gender"
                    className="mt-2 grid grid-cols-2 gap-2 sm:max-w-xs"
                  >
                    {(Object.keys(GENDER_LABELS) as Gender[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={gender === value}
                        disabled={locked}
                        onClick={() => setGender(value)}
                        className={cn(
                          "tap-target rounded-xl border px-4 text-sm font-semibold transition-colors",
                          gender === value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {GENDER_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold">3. Save</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You may set this photo once and change it once more yourself. Any further
                    change needs SuperAdmin clearance.
                  </p>
                  <Button
                    type="button"
                    className="tap-target mt-3 w-full rounded-xl sm:w-auto"
                    disabled={!ready || upload.isPending}
                    onClick={() => upload.mutate()}
                  >
                    <Check className="size-4" aria-hidden />
                    {upload.isPending ? "Saving…" : "Save identifier photo"}
                  </Button>
                </div>
              </div>
            </section>

            {locked ? (
              <section className="surface-card flex items-start gap-3 rounded-2xl p-5">
                <Lock className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Photo changes are locked</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You have used your self-service change. Request SuperAdmin clearance to
                    replace your identifier photo.
                  </p>
                  <Button
                    variant="outline"
                    className="tap-target mt-3 rounded-xl"
                    onClick={() => {
                      profileService
                        .requestPhotoChangeClearance("Student requested a photo change")
                        .then(() => toast.success("Clearance request sent"))
                        .catch((error: unknown) =>
                          toast.error(
                            error instanceof BackendNotConnectedError
                              ? "Clearance requests are not connected yet."
                              : "Could not send the request.",
                          ),
                        );
                    }}
                  >
                    <Upload className="size-4" aria-hidden /> Request clearance
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
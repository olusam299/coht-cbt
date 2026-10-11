/** One-time student identifier photo onboarding. */
export type Gender = "male" | "female";

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
};

export interface StudentProfile {
  studentId: string;
  fullName: string;
  matricNumber: string;
  departmentId: string | null;
  programme: string | null;
  level: string | null;
  gender: Gender | null;
  /** Small square JPEG served from storage; null until onboarding completes. */
  photoUrl: string | null;
  /**
   * A student may set the identifier photo once and change it once. Beyond
   * that the server refuses; SuperAdmin clearance is required.
   */
  photoChangeCount: number;
  photoLockedUntilClearance: boolean;
  /** A change request is waiting for the SuperAdmin. */
  photoRequestPending: boolean;
  onboardingComplete: boolean;
}

export const MAX_SELF_SERVICE_PHOTO_CHANGES = 1;

/** The server decides: self-service allows one change, then SuperAdmin clearance. */
export function canChangePhoto(profile: StudentProfile): boolean {
  return !profile.photoLockedUntilClearance;
}

export function greetingFor(date: Date, firstName: string): string {
  const hour = date.getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${firstName}`;
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
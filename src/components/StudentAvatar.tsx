import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Gender } from "@/lib/student-profile";

const SIZES = {
  sm: "size-9 text-[0.65rem]",
  md: "size-12 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-lg",
} as const;

export type AvatarSize = keyof typeof SIZES;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Circular WhatsApp-style identifier photo with a restrained gender pip.
 * Used on the student dashboard and every monitoring surface.
 */
export function StudentAvatar({
  name,
  photoUrl,
  gender,
  size = "md",
  className,
  ring = true,
}: {
  name: string;
  photoUrl?: string | null;
  gender?: Gender | null;
  size?: AvatarSize;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      <span
        className={cn(
          "grid overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground place-items-center",
          ring && "ring-2 ring-background outline outline-1 outline-border",
          SIZES[size],
        )}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Identifier photo of ${name}`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : initials(name) ? (
          <span aria-hidden>{initials(name)}</span>
        ) : (
          <User className="size-1/2" aria-hidden />
        )}
      </span>
      {gender ? (
        <span
          title={gender === "male" ? "Male" : "Female"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-background font-bold leading-none text-[0.55rem]",
            size === "sm" ? "size-3.5" : size === "xl" ? "size-6 text-[0.7rem]" : "size-4",
            gender === "male"
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground",
          )}
        >
          <span aria-hidden>{gender === "male" ? "M" : "F"}</span>
          <span className="sr-only">{gender === "male" ? "Male" : "Female"}</span>
        </span>
      ) : null}
    </span>
  );
}
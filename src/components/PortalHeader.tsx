import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PortalHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img
            src="/college-logo.png"
            alt="Taraba State College of Health Technology"
            className="size-10 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-border/60"
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-bold leading-tight sm:text-base">
              College of Health
            </span>
            <span className="block text-xs text-muted-foreground">CBT Portal</span>
          </span>
        </Link>
        {actions}
      </div>
    </header>
  );
}
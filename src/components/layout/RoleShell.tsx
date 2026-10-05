import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import type { NavItem } from "./nav-config";

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function isActive(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

function NavList({
  items,
  pathname,
  onNavigate,
  compact = false,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "tap-target flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              compact ? "py-2" : "py-2.5",
              active
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Shared chrome for the Admin and SuperAdmin consoles.
 *
 * Desktop: persistent sidebar. Tablet: collapsible sheet from a slim top bar
 * with breathing room for touch. Phone: top bar + bottom tab bar so the
 * primary destinations stay in thumb reach.
 */
export function RoleShell({
  role,
  items,
  title,
  subtitle,
  actions,
  children,
}: {
  role: Role;
  items: NavItem[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useActivePath();
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = items.filter((item) => item.primary).slice(0, 5);

  const brand = (
    <div className="flex items-center gap-3">
      <img
        src="/college-logo.png"
        alt="Taraba State College of Health Technology"
        className="size-10 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-border/60"
      />
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-bold leading-tight">
          COHT CBT
        </span>
        <span className="block text-xs text-muted-foreground">{ROLE_LABELS[role]} console</span>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-card/60 px-4 py-5 lg:flex">
        {brand}
        <div className="mt-7 flex-1 overflow-y-auto">
          <NavList items={items} pathname={pathname} />
        </div>
        <Button asChild variant="ghost" className="tap-target justify-start rounded-xl">
          <Link to="/auth">
            <LogOut className="size-4" aria-hidden /> Sign out
          </Link>
        </Button>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation"
              className="tap-target shrink-0 rounded-xl lg:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-base font-bold sm:text-lg">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[100rem] flex-1 px-3 py-5 pb-24 sm:px-6 lg:py-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Phone: primary destinations in thumb reach */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col border-t bg-card/95 px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "tap-target flex flex-col items-center justify-center gap-1 rounded-lg text-[0.65rem] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.short}
            </Link>
          );
        })}
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[17rem] px-4 py-5">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </SheetHeader>
          {brand}
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavList items={items} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </div>
            <Button asChild variant="ghost" className="tap-target mt-4 w-full justify-start rounded-xl">
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <LogOut className="size-4" aria-hidden /> Sign out
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Consistent section heading used across both consoles. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <div className="surface-card rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-bold tabular-nums",
          tone === "warning" && "text-warning-foreground",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
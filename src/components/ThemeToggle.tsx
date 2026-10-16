import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/** Switches between the light and dark colour schemes. */
export function ThemeToggle({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("tap-target rounded-xl", className)}
      onClick={toggle}
      aria-pressed={dark}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      {showLabel ? <span className="hidden sm:inline">{dark ? "Light mode" : "Dark mode"}</span> : null}
    </Button>
  );
}

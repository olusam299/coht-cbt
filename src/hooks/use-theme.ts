import { useCallback, useEffect, useState } from "react";
import { currentTheme, setTheme, THEME_EVENT, type Theme } from "@/lib/theme";

export function useTheme() {
  // Always "light" on the server and first paint; the real value is read once mounted.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const sync = () => setThemeState(currentTheme());
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => setTheme(currentTheme() === "dark" ? "light" : "dark"), []);
  return { theme, toggle };
}

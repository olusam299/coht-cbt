/** Light/dark colour scheme. The choice is saved on the device; with no choice, the device's own setting is used. */
export type Theme = "light" | "dark";

export const THEME_KEY = "coht.theme";
export const THEME_EVENT = "coht-theme";

/** Pure rule: a saved choice wins, otherwise follow the device. */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === "dark" || stored === "light") return stored;
  return systemPrefersDark ? "dark" : "light";
}

export function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage unavailable: the choice lasts until the page is closed
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Runs in the page head before anything is drawn, so a dark-mode user never sees a white flash.
 * Keep it self-contained: it is inlined as plain text.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

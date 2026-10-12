/**
 * Transport-security rules. Everything the app sends to the database, including
 * OTPs and answers, must travel over TLS, and sign-in must only be offered on a
 * page that was itself delivered over HTTPS (otherwise someone on the same
 * network could alter the page and read what is typed into it).
 */

export const isLocalHostname = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]" ||
  hostname === "::1" ||
  hostname.endsWith(".localhost");

/** The API address must be https. Plain http is allowed only for a database on this same machine, in development. */
export function assertSecureApiUrl(url: string, isDev: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("VITE_SUPABASE_URL is not a valid address.");
  }
  if (parsed.protocol === "https:") return;
  if (isDev && parsed.protocol === "http:" && isLocalHostname(parsed.hostname)) return;
  throw new Error("VITE_SUPABASE_URL must start with https:// so OTPs and answers are encrypted in transit.");
}

/** Where to send a visitor who opened a production page over plain http, or null if no redirect applies. */
export function httpsUpgradeUrl(
  location: { protocol: string; hostname: string; href: string },
  isProd: boolean,
): string | null {
  if (!isProd || location.protocol !== "http:" || isLocalHostname(location.hostname)) return null;
  return `https:${location.href.slice("http:".length)}`;
}

export type ConnectionState = "secure" | "insecure-dev" | "insecure-prod";

/** isSecureContext is true for https pages and for localhost. */
export function connectionState(isSecureContext: boolean, isProd: boolean): ConnectionState {
  if (isSecureContext) return "secure";
  return isProd ? "insecure-prod" : "insecure-dev";
}

export const SECURITY_HEADERS: Record<string, string> = {
  // Browsers ignore HSTS on http, so it only takes effect once the site is served over https.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  // Upgrades any stray http sub-resource to https and blocks framing by other sites.
  "Content-Security-Policy": "upgrade-insecure-requests; frame-ancestors 'self'",
};

export function withSecurityHeaders(response: Response): Response {
  // Upgrade (WebSocket) responses cannot be re-wrapped.
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

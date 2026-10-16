import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { connectionState, httpsUpgradeUrl, type ConnectionState } from "@/lib/transport-security";

/**
 * Shows its children only on a connection that is safe for sign-in.
 * - https (or localhost): children render normally.
 * - Production over plain http: sign-in is withheld and the visitor is pointed to the https address.
 * - Development over plain http (for example a phone on the office network): children render
 *   with a visible warning, so test OTPs are not mistaken for a secure setup.
 */
export function SecureConnectionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectionState | "checking">("checking");
  const [secureUrl, setSecureUrl] = useState<string | null>(null);

  useEffect(() => {
    setState(connectionState(window.isSecureContext, import.meta.env.PROD));
    setSecureUrl(httpsUpgradeUrl(window.location, true));
  }, []);

  if (state === "checking") {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking connection…</main>;
  }

  if (state === "insecure-prod") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="surface-card w-full max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden />
          <h1 className="mt-4 font-display text-xl font-bold">This connection is not secure</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            For your protection, sign-in is only available over HTTPS. Do not enter your OTP on this page.
          </p>
          {secureUrl ? (
            <a
              href={secureUrl}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Open the secure version
            </a>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <>
      {state === "insecure-dev" ? (
        <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          Development only: this page is not served over HTTPS. Do not use real OTPs here.
        </div>
      ) : null}
      {children}
    </>
  );
}

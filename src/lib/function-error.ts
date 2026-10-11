/**
 * supabase-js hides the body of a failed edge function call behind a generic
 * "non-2xx status code" message. The functions return { error: "..." }, so read
 * that to show the real reason.
 */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (typeof Response !== "undefined" && context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body && typeof body.error === "string" && body.error) return body.error;
    } catch {
      // fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : "The request failed.";
}

/** True for failures caused by the connection itself (as opposed to the server refusing a request). */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ((error as { message?: string } | null)?.message ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|network connection was lost|timed out|timeout|err_internet|err_network|fetch failed/i.test(
    message,
  );
}

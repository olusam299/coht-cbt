import type { ReactNode } from "react";
import { PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeletonGrid, EmptyState, ErrorState, LoadingState } from "@/components/states";
import { BackendNotConnectedError } from "@/services";

/** Honest "the backend isn't wired yet" panel — never a fake dataset. */
export function NotConnectedState({
  operation,
  description,
  onRetry,
}: {
  operation: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="status"
      className="surface-card mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center"
    >
      <span className="grid size-11 place-items-center rounded-full bg-warning/15 text-warning-foreground">
        <PlugZap className="size-5" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">Backend not connected</h2>
      <p className="text-sm text-muted-foreground">
        {description ??
          "This screen is ready and will populate as soon as the examination backend is wired in."}
      </p>
      <code className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
        {operation}
      </code>
      {onRetry ? (
        <Button variant="outline" className="tap-target mt-1 rounded-xl" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
}

/**
 * Renders the honest loading / not-connected / error / empty state for a
 * service-backed query, or the children when real data has arrived.
 */
export function ServiceState<T>({
  query,
  skeleton = "cards",
  emptyTitle,
  emptyDescription,
  emptyAction,
  isEmpty,
  children,
}: {
  query: QueryLike<T>;
  skeleton?: "cards" | "inline";
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return skeleton === "cards" ? <CardSkeletonGrid /> : <LoadingState />;
  }
  if (query.isError) {
    if (query.error instanceof BackendNotConnectedError) {
      return (
        <NotConnectedState operation={query.error.message} onRetry={() => query.refetch()} />
      );
    }
    return (
      <ErrorState
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  }
  const data = query.data as T;
  const empty = isEmpty
    ? isEmpty(data)
    : Array.isArray(data)
      ? data.length === 0
      : data == null;
  if (empty) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }
  return <>{children(data)}</>;
}
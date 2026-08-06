"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

/**
 * Scoped to the dashboard so a failure in one page keeps the shell — sidebar,
 * topbar, and command palette all stay usable.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Dashboard section failed:", error);
  }, [error]);

  return (
    <ErrorState
      title="We could not load this section"
      description="The rest of the app is still fine. Retry, or head back to the dashboard."
      detail={
        process.env.NODE_ENV === "development"
          ? `${error.message}${error.digest ? `\n\nDigest: ${error.digest}` : ""}`
          : undefined
      }
      onRetry={reset}
      action={
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}

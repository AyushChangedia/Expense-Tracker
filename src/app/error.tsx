"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { GradientBlobs } from "@/components/shared/gradient-blobs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <GradientBlobs variant="subtle" />

      <div className="w-full max-w-lg">
        <ErrorState
          title="This page hit a snag"
          description="Something failed while rendering. Trying again usually clears it — if it keeps happening, the details below help track it down."
          detail={
            process.env.NODE_ENV === "development"
              ? `${error.message}${error.digest ? `\n\nDigest: ${error.digest}` : ""}`
              : error.digest
                ? `Digest: ${error.digest}`
                : undefined
          }
          onRetry={reset}
          action={
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

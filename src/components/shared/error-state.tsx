"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** Shown in a collapsible block — useful in development. */
  detail?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this section. Trying again usually sorts it out.",
  detail,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "glass flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
      role="alert"
    >
      <div className="relative mb-5">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-danger/25 blur-2xl"
        />
        <div className="grid size-14 place-items-center rounded-2xl border border-danger/20 bg-danger/10">
          <AlertTriangle className="size-6 text-danger" strokeWidth={1.6} />
        </div>
      </div>

      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>

      {detail ? (
        <details className="mt-4 w-full max-w-lg text-left">
          <summary className="cursor-pointer text-xs text-subtle transition-colors hover:text-muted-foreground">
            Technical details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {detail}
          </pre>
        </details>
      ) : null}

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
        {onRetry ? (
          <Button onClick={onRetry} variant="secondary">
            <RefreshCw className="size-4" />
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </motion.div>
  );
}

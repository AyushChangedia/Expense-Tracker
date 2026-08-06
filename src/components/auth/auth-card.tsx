"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass glow-border relative overflow-hidden", className)}
      data-active="true"
    >
      {/* Gradient hairline across the top edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"
      />

      <div className="space-y-1.5 p-7 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      </div>

      <div className="px-7 pb-7">{children}</div>

      {footer ? (
        <div className="border-t border-white/[0.06] px-7 py-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </motion.div>
  );
}

/** Inline error banner used above auth forms. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      role="alert"
      className="overflow-hidden"
    >
      <p className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
        {message}
      </p>
    </motion.div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      className="overflow-hidden"
    >
      <p className="rounded-xl border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success">
        {message}
      </p>
    </motion.div>
  );
}

/** Field wrapper: label, control, and the error message beneath it. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  action,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </label>
        {action}
      </div>

      {children}

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

import * as React from "react";

import { cn } from "@/lib/utils";

/** The FluxFin mark — a stylised "F" drawn on the brand gradient. */
export function LogoMark({ className }: { className?: string }) {
  const gradientId = React.useId();

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.04)" />
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path
        d="M11 22V13.5C11 11.567 12.567 10 14.5 10H21"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11 16.5H18.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark ? (
        <span className="text-lg font-semibold tracking-tight text-white">
          Flux<span className="gradient-text">Fin</span>
        </span>
      ) : null}
    </span>
  );
}

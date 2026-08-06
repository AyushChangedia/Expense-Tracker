"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Google's mark — inlined so it needs no external asset or network request. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.64 6.16-4.64Z"
      />
    </svg>
  );
}

export function GoogleButton({
  callbackUrl = "/dashboard",
  label = "Continue with Google",
}: {
  callbackUrl?: string;
  label?: string;
}) {
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    setPending(true);
    try {
      // Redirects on success, so the pending state simply persists until the
      // browser navigates away.
      await signIn("google", { callbackUrl });
    } catch {
      toast.error("We could not reach Google. Please try again.");
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={handleClick}
      loading={pending}
    >
      {!pending ? <GoogleIcon /> : null}
      {label}
    </Button>
  );
}

/** "or" rule between the OAuth button and the email form. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <span className="w-full border-t border-white/[0.08]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-surface px-3 text-xs uppercase tracking-wider text-subtle">
          {label}
        </span>
      </div>
    </div>
  );
}

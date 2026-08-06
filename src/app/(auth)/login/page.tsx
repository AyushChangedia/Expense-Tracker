import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { googleEnabled } from "@/lib/auth.config";
import { AuthFormSkeleton } from "@/components/auth/auth-skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your FluxFin account.",
};

export default function LoginPage() {
  return (
    // `useSearchParams` inside the form requires a Suspense boundary so the
    // page can still be statically prerendered.
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}

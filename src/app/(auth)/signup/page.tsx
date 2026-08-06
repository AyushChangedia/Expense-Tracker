import { Suspense } from "react";
import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/signup-form";
import { googleEnabled } from "@/lib/auth.config";
import { AuthFormSkeleton } from "@/components/auth/auth-skeleton";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Start tracking your money with FluxFin.",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton rows={4} />}>
      <SignUpForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}

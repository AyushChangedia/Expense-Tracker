import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { verifyResetToken } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your FluxFin account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  // Check the token server-side so a dead link says so before the user types
  // a password into a form that cannot succeed.
  const valid = token ? await verifyResetToken(token) : false;

  return <ResetPasswordForm token={token} valid={valid} />;
}

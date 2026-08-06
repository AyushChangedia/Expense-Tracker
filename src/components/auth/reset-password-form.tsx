"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ShieldX } from "lucide-react";
import { motion } from "framer-motion";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { resetPassword } from "@/server/actions/auth";
import { resetPasswordSchema } from "@/lib/validations";

type FormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({
  token,
  valid,
}: {
  token: string;
  valid: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const password = form.watch("password");

  async function onSubmit(values: FormValues) {
    setPending(true);
    setFormError(null);

    const result = await resetPassword(values);

    if (!result.ok) {
      setFormError(result.error);
      setPending(false);
      return;
    }

    router.replace("/login?reset=1");
  }

  if (!valid) {
    return (
      <AuthCard
        title="This link is no longer valid"
        description="Reset links expire after an hour and can only be used once."
        footer={
          <Link
            href="/forgot-password"
            className="font-medium text-primary-300 transition-colors hover:text-primary-200"
          >
            Request a new link
          </Link>
        }
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-4 py-4 text-center"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full bg-danger/25 blur-2xl"
            />
            <div className="relative grid size-14 place-items-center rounded-2xl border border-danger/20 bg-danger/10">
              <ShieldX className="size-6 text-danger" strokeWidth={1.7} />
            </div>
          </div>

          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Request a fresh link and we will email you a new one right away.
          </p>

          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you have not used here before. You will be signed in with it next."
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-primary-300 transition-colors hover:text-primary-200"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <FormError message={formError} />

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <input type="hidden" {...form.register("token")} />

          <Field
            label="New password"
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              autoFocus
              invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <PasswordStrength value={password ?? ""} />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={form.formState.errors.confirmPassword?.message}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(form.formState.errors.confirmPassword)}
              {...form.register("confirmPassword")}
            />
          </Field>

          <Button type="submit" className="w-full" loading={pending}>
            Update password
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

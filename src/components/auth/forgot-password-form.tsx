"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck, Mail } from "lucide-react";
import { motion } from "framer-motion";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { requestPasswordReset } from "@/server/actions/auth";
import { forgotPasswordSchema } from "@/lib/validations";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [devLink, setDevLink] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    setFormError(null);

    const result = await requestPasswordReset(values);
    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setSent(true);
    // Present only when no mail provider is configured and we are not in
    // production — lets the flow be completed on a fresh local clone.
    setDevLink(result.data.devResetUrl ?? null);
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        description="If that email is registered, a reset link is on its way. It expires in one hour."
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
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-4 py-4 text-center"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full bg-success/25 blur-2xl"
            />
            <div className="relative grid size-14 place-items-center rounded-2xl border border-success/20 bg-success/10">
              <MailCheck className="size-6 text-success" strokeWidth={1.7} />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Sent to{" "}
            <span className="font-medium text-white">{form.getValues("email")}</span>
          </p>

          {devLink ? (
            <div className="w-full space-y-2 rounded-xl border border-warning/25 bg-warning/10 p-3.5 text-left">
              <p className="text-xs font-medium text-warning">
                Development mode — no mail provider configured
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Set <code className="font-mono text-[11px]">RESEND_API_KEY</code> to
                send real emails. In the meantime, use this link:
              </p>
              <Link
                href={devLink}
                className="block break-all font-mono text-[11px] text-primary-300 underline underline-offset-2 transition-colors hover:text-primary-200"
              >
                {devLink}
              </Link>
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSent(false);
              setDevLink(null);
            }}
          >
            Use a different email
          </Button>
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email on your account and we will send you a link to choose a new password."
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
          <Field
            label="Email"
            htmlFor="email"
            error={form.formState.errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              icon={<Mail />}
              invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
          </Field>

          <Button type="submit" className="w-full" loading={pending}>
            Send reset link
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

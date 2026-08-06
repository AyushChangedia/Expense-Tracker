"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { PasswordInput } from "@/components/auth/password-input";
import { signInWithCredentials } from "@/server/actions/auth";
import { signInSchema } from "@/lib/validations";

type FormValues = z.infer<typeof signInSchema>;

/** Maps Auth.js error codes in the query string to human sentences. */
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a password. Sign in with your password instead.",
  OAuthSignin: "We could not start the Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in did not complete. Please try again.",
  AccessDenied: "That sign-in was cancelled.",
  Configuration: "Google sign-in is not configured on this deployment.",
};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const registered = searchParams.get("registered") === "1";
  const reset = searchParams.get("reset") === "1";
  const oauthError = searchParams.get("error");

  const [formError, setFormError] = React.useState<string | null>(
    oauthError ? (OAUTH_ERRORS[oauthError] ?? "We could not sign you in.") : null,
  );
  const [pending, setPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    setFormError(null);

    const result = await signInWithCredentials(values);

    if (!result.ok) {
      setFormError(result.error);
      setPending(false);
      return;
    }

    // The session cookie is set by the action; refresh so the server layout
    // picks it up, then navigate.
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to pick up where your money left off."
      footer={
        <>
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary-300 transition-colors hover:text-primary-200"
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {registered ? (
          <p className="rounded-xl border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success">
            Account created. Sign in to continue.
          </p>
        ) : null}

        {reset ? (
          <p className="rounded-xl border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-success">
            Password updated. Sign in with your new password.
          </p>
        ) : null}

        <FormError message={formError} />

        {googleEnabled ? (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <AuthDivider label="or sign in with email" />
          </>
        ) : null}

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

          <Field
            label="Password"
            htmlFor="password"
            error={form.formState.errors.password?.message}
            action={
              <Link
                href="/forgot-password"
                className="text-xs text-primary-300 transition-colors hover:text-primary-200"
              >
                Forgot?
              </Link>
            }
          >
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
          </Field>

          <Button type="submit" className="w-full" loading={pending}>
            Sign in
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

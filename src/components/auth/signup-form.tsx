"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, User } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard, Field, FormError } from "@/components/auth/auth-card";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { registerUser, signInWithCredentials } from "@/server/actions/auth";
import { signUpSchema } from "@/lib/validations";

type FormValues = z.infer<typeof signUpSchema>;

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const password = form.watch("password");

  async function onSubmit(values: FormValues) {
    setPending(true);
    setFormError(null);

    const result = await registerUser(values);

    if (!result.ok) {
      setFormError(result.error);

      // Surface field-level problems on the right inputs.
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0] && field in form.getValues()) {
          form.setError(field as keyof FormValues, { message: messages[0] });
        }
      }

      setPending(false);
      return;
    }

    // Sign the new account straight in rather than bouncing to the login form.
    const signInResult = await signInWithCredentials({
      email: values.email,
      password: values.password,
    });

    if (!signInResult.ok) {
      router.replace("/login?registered=1");
      return;
    }

    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <AuthCard
      title="Create your account"
      description="Set up in under a minute. Your categories are ready the moment you land."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary-300 transition-colors hover:text-primary-200"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <FormError message={formError} />

        {googleEnabled ? (
          <>
            <GoogleButton callbackUrl={callbackUrl} label="Sign up with Google" />
            <AuthDivider label="or sign up with email" />
          </>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              icon={<User />}
              invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
          </Field>

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
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
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
            Create account
          </Button>

          <p className="text-center text-xs leading-relaxed text-subtle">
            By continuing you agree that this is your data, in your database, and
            you are responsible for backing it up.
          </p>
        </form>
      </div>
    </AuthCard>
  );
}

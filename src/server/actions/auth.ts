"use server";

import { createHash, randomBytes } from "node:crypto";
import { AuthError } from "next-auth";
import { headers } from "next/headers";

import { hashPassword, signIn, signOut, verifyPassword } from "@/lib/auth";
import { ensureDefaultCategories } from "@/lib/bootstrap";
import { passwordResetEmail, sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations";
import { notify } from "@/server/queries/activity";
import { ActionError, parseInput, runAction } from "@/server/actions/helpers";
import type { ActionResult } from "@/types";
import { safeCallbackUrl } from "@/lib/auth.config";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // one hour

/** Reset tokens are stored hashed, so a database leak cannot be replayed. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Sign up / sign in / sign out
// ---------------------------------------------------------------------------

export async function registerUser(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const data = parseInput(signUpSchema, input);

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, passwordHash: true },
    });

    if (existing) {
      // Someone who signed up through Google and is now setting a password
      // should be told exactly that, not "email taken".
      throw new ActionError(
        existing.passwordHash
          ? "An account with that email already exists. Try signing in."
          : "That email is registered through Google. Sign in with Google instead.",
        { email: ["An account with that email already exists."] },
      );
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
      },
      select: { id: true },
    });

    await ensureDefaultCategories(user.id);

    await notify({
      userId: user.id,
      title: "Welcome to FluxFin",
      message:
        "Your categories are ready. Add your first transaction to light up the dashboard.",
      type: "SUCCESS",
      href: "/transactions",
    });

    return user.id;
  }, "Account created");
}

export async function signInWithCredentials(
  input: unknown,
): Promise<ActionResult<undefined>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check your details and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error:
          error.type === "CredentialsSignin"
            ? "That email and password do not match."
            : "We could not sign you in. Please try again.",
      };
    }
    throw error;
  }
}

export async function signInWithGoogle(callbackUrl = "/dashboard"): Promise<void> {
  // Throws a redirect on success — nothing after this line runs.
  // A server action is callable with any argument, so the same guard the
  // sign-in form applies has to hold here too.
  await signIn("google", { redirectTo: safeCallbackUrl(callbackUrl) });
}

export async function signOutUser(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export type ForgotPasswordResult = {
  /** Present only in development, so the flow is testable without a mail provider. */
  devResetUrl?: string;
};

export async function requestPasswordReset(
  input: unknown,
): Promise<ActionResult<ForgotPasswordResult>> {
  return runAction(async () => {
    const data = parseInput(forgotPasswordSchema, input);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });

    // Always report success. Telling the caller whether an address exists
    // would turn this form into an account enumeration oracle.
    if (!user || !user.passwordHash) {
      return {};
    }

    // One live token per account.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const origin = await resolveOrigin();
    const resetUrl = `${origin}/reset-password?token=${token}`;
    const message = passwordResetEmail(resetUrl, user.name);

    const result = await sendEmail({
      to: user.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (!result.delivered && process.env.NODE_ENV !== "production") {
      return { devResetUrl: resetUrl };
    }

    return {};
  });
}

export async function resetPassword(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = parseInput(resetPasswordSchema, input);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(data.token) },
      select: { id: true, userId: true, expires: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expires.getTime() < Date.now()) {
      throw new ActionError(
        "That reset link has expired or already been used. Request a new one.",
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(data.password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Any other live token for this account is now stale.
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, NOT: { id: record.id } },
      }),
      // Database sessions are invalidated too, so an attacker holding one is
      // logged out by the reset.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    await notify({
      userId: record.userId,
      title: "Password changed",
      message: "Your password was reset. If that was not you, reset it again immediately.",
      type: "WARNING",
      href: "/settings",
    });

    return undefined;
  }, "Password updated");
}

/** Checks a reset link before rendering the form, so a dead link says so up front. */
export async function verifyResetToken(token: string): Promise<boolean> {
  if (!token || token.length < 10) return false;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expires: true, usedAt: true },
  });

  return Boolean(record && !record.usedAt && record.expires.getTime() > Date.now());
}

export async function changePassword(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const data = parseInput(changePasswordSchema, input);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new ActionError(
        "This account signs in with Google, so there is no password to change.",
      );
    }

    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new ActionError("That current password is not right.", {
        currentPassword: ["That current password is not right."],
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });

    await notify({
      userId,
      title: "Password changed",
      message: "Your password was updated successfully.",
      type: "SUCCESS",
      href: "/settings",
    });

    return undefined;
  }, "Password updated");
}

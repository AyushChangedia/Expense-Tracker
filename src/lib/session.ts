import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { UserPreferences } from "@/types";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
} & UserPreferences;

/**
 * `cache` dedupes the session lookup across a single render pass, so a layout
 * and five server components asking for the user cost one call.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    image: session.user.image ?? null,
    currency: session.user.currency ?? "USD",
    dateFormat: session.user.dateFormat ?? "MMM d, yyyy",
    locale: session.user.locale ?? "en-US",
    weekStart: session.user.weekStart ?? 0,
  };
});

/** Use in pages and layouts — redirects to sign-in when there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Use in server actions. Throws instead of redirecting so the action can
 * return a structured error to the client.
 */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user.id;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You need to be signed in to do that.");
    this.name = "UnauthorizedError";
  }
}

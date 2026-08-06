import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserPreferences } from "@/types";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
} & UserPreferences;

/**
 * The signed-in user, with preferences read from the database.
 *
 * Preferences deliberately do *not* live in the JWT. A token is a snapshot
 * taken at sign-in, so caching currency or date format there means changing
 * them in settings has no visible effect until the token is refreshed — the
 * whole app keeps formatting money in the old currency. Reading them here
 * makes the database the single source of truth.
 *
 * The cost is one indexed lookup per render, deduped by React `cache()` across
 * every server component in the tree, which is the right trade for never
 * showing a user stale settings.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const record = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      currency: true,
      dateFormat: true,
      locale: true,
      weekStart: true,
    },
  });

  // The token can outlive the account it points at — treat that as signed out
  // rather than letting a dangling id reach the queries.
  if (!record) return null;

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    image: record.image,
    currency: record.currency,
    dateFormat: record.dateFormat,
    locale: record.locale,
    weekStart: record.weekStart,
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

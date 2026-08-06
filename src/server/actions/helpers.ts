import { Prisma } from "@prisma/client";
import { z } from "zod";

import { UnauthorizedError } from "@/lib/session";
import type { ActionResult } from "@/types";

/**
 * Wraps a server action so every failure path returns the same
 * `{ ok: false, error }` envelope instead of throwing across the RSC
 * boundary — the client only ever branches on `result.ok`.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (error) {
    return { ok: false, ...describeError(error) };
  }
}

export function describeError(error: unknown): {
  error: string;
  fieldErrors?: Record<string, string[]>;
} {
  if (error instanceof UnauthorizedError) {
    return { error: error.message };
  }

  if (error instanceof z.ZodError) {
    return {
      error: error.issues[0]?.message ?? "Please check the highlighted fields.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  if (error instanceof ActionError) {
    return { error: error.message, fieldErrors: error.fieldErrors };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return { error: "That already exists. Try a different name." };
      case "P2003":
        return { error: "That referenced record no longer exists." };
      case "P2025":
        return { error: "We could not find that record." };
      default:
        break;
    }
  }

  console.error("Server action failed:", error);
  return { error: "Something went wrong. Please try again." };
}

/** A failure the user is meant to read — not a bug. */
export class ActionError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

/** Zod parse that throws an ActionError shaped for the form. */
export function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ActionError(
      result.error.issues[0]?.message ?? "Please check the highlighted fields.",
      result.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  return result.data;
}

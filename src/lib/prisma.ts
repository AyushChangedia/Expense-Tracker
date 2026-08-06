import { PrismaClient } from "@prisma/client";

/**
 * Next.js dev-mode hot reloading re-evaluates modules on every request, which
 * would otherwise open a new connection pool each time. Caching the client on
 * `globalThis` keeps a single pool alive across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

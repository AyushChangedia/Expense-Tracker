import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { signInSchema } from "@/lib/validations";
import { ensureDefaultCategories } from "@/lib/bootstrap";

declare module "next-auth" {
  interface Session {
    /**
     * Only identity lives on the session. Preferences (currency, date format,
     * locale, week start) are read from the database by `getSessionUser` —
     * see the note there for why they must not be cached on the token.
     */
    user: { id: string } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            passwordHash: true,
          },
        });

        // Compare against a dummy hash when the account does not exist so the
        // response time does not reveal whether the email is registered.
        const hash =
          user?.passwordHash ??
          "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
        const valid = await bcrypt.compare(parsed.data.password, hash);

        if (!user?.passwordHash || !valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    /**
     * A brand-new Google account arrives with no categories, which would leave
     * the dashboard unusable. Seed the default catalogue on first sign-in.
     */
    async createUser({ user }) {
      if (user.id) {
        await ensureDefaultCategories(user.id);
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.sub = user.id;
      }

      // Only display identity is mirrored onto the token, and only when it
      // could have changed. Everything the app formats with — currency, date
      // format, locale, week start — is read from the database per request by
      // `getSessionUser`, so a settings change takes effect immediately
      // instead of waiting out the token's lifetime.
      if (token.sub && (user || trigger === "update")) {
        const record = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true, email: true, image: true },
        });

        if (record) {
          token.name = record.name;
          token.email = record.email;
          token.picture = record.image;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

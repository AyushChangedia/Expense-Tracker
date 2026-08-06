import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { GradientBlobs } from "@/components/shared/gradient-blobs";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <GradientBlobs variant="default" />

      <header className="container flex h-16 shrink-0 items-center justify-between">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back home
        </Link>
      </header>

      <main className="container flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="container shrink-0 py-6 text-center">
        <p className="text-xs text-subtle">
          Your data lives in your own PostgreSQL database.
        </p>
      </footer>
    </div>
  );
}

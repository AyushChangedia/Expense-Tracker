import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GradientBlobs } from "@/components/shared/gradient-blobs";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <GradientBlobs variant="subtle" />

      <header className="container flex h-16 items-center">
        <Link href="/" className="rounded-lg">
          <Logo />
        </Link>
      </header>

      <main className="container flex flex-1 items-center justify-center py-10">
        <div className="glass glow-border w-full max-w-md p-8 text-center">
          <div className="relative mx-auto mb-6 w-fit">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/25 blur-2xl"
            />
            <div className="relative grid size-16 place-items-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/20 to-cyan/10">
              <Compass className="size-7 text-primary-200" strokeWidth={1.5} />
            </div>
          </div>

          <p className="gradient-text text-5xl font-semibold tracking-tight">404</p>
          <h1 className="mt-3 text-lg font-semibold text-white">
            That page does not exist
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            The link may be out of date, or the page may have moved. Everything
            else is where you left it.
          </p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Command,
  PiggyBank,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GradientBlobs } from "@/components/shared/gradient-blobs";
import { Logo } from "@/components/shared/logo";
import { getSessionUser } from "@/lib/session";
import { RevealOnScroll, StaggerChildren } from "@/components/shared/reveal";
import { HeroPreview } from "@/components/marketing/hero-preview";

const FEATURES = [
  {
    icon: Wallet,
    title: "Every transaction, organised",
    description:
      "Create, edit, duplicate, tag, and bulk-manage entries. Search and filters that respond as you type, with undo on every delete.",
    gradient: "from-[#7C3AED] to-[#A855F7]",
  },
  {
    icon: BarChart3,
    title: "Analytics that explain",
    description:
      "Monthly trends, category breakdowns, cash-flow curves, and net-worth growth — all computed from your own numbers.",
    gradient: "from-[#38BDF8] to-[#22D3EE]",
  },
  {
    icon: PiggyBank,
    title: "Budgets that warn early",
    description:
      "Set a cap per category. Progress bars turn amber near the limit and red past it, with a projection of where the month lands.",
    gradient: "from-[#F59E0B] to-[#EF4444]",
  },
  {
    icon: RefreshCw,
    title: "Recurring on autopilot",
    description:
      "Daily, weekly, monthly, or yearly rules post themselves — including any backlog — so rent and subscriptions never go missing.",
    gradient: "from-[#22D3EE] to-[#3B82F6]",
  },
  {
    icon: Target,
    title: "Goals with real maths",
    description:
      "Track savings targets and see exactly how much per month gets you there before the deadline.",
    gradient: "from-[#22C55E] to-[#4ADE80]",
  },
  {
    icon: CalendarDays,
    title: "Calendar and quick add",
    description:
      'Click any day to see or add spending. Or just type "spent $25 on pizza yesterday" and let it parse itself.',
    gradient: "from-[#EC4899] to-[#8B5CF6]",
  },
];

const STATS = [
  { value: "14", label: "Built-in categories" },
  { value: "7", label: "Analytics views" },
  { value: "3", label: "Export formats" },
  { value: "⌘K", label: "Command palette" },
];

export default async function LandingPage() {
  // Someone already signed in has no reason to see the pitch.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <GradientBlobs variant="hero" />

      {/* ---------------------------------------------------------------- */}
      {/* Nav                                                              */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-canvas/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="rounded-lg focus-visible:ring-2">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* -------------------------------------------------------------- */}
        {/* Hero                                                           */}
        {/* -------------------------------------------------------------- */}
        <section className="container relative pb-20 pt-16 sm:pt-24 lg:pb-28 lg:pt-32">
          <RevealOnScroll>
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-xl">
                <Sparkles className="size-3.5 text-primary-300" />
                Budgets, goals, and insights in one place
              </span>

              <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Money,{" "}
                <span className="gradient-text bg-[length:200%_auto] animate-gradient-pan">
                  beautifully
                </span>{" "}
                tracked.
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                FluxFin turns raw transactions into an honest picture of your
                finances — where the money went, what it means, and what to do
                about it before the month runs out.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Start tracking free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login">
                    <Command className="size-4" />
                    See the dashboard
                  </Link>
                </Button>
              </div>

              <p className="mt-4 text-xs text-subtle">
                No credit card. Your data stays in your own database.
              </p>
            </div>
          </RevealOnScroll>

          {/* Stat row, echoing the inspiration's card strip. */}
          <StaggerChildren className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="glass glow-border p-5 text-center transition-transform duration-500 ease-smooth hover:-translate-y-1"
              >
                <p className="gradient-text text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </StaggerChildren>

          {/* Floating product preview. */}
          <RevealOnScroll delay={0.15}>
            <div className="relative mx-auto mt-16 max-w-5xl lg:mt-20">
              <div
                aria-hidden
                className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-primary/10 blur-3xl"
              />
              <HeroPreview />
            </div>
          </RevealOnScroll>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Features                                                       */}
        {/* -------------------------------------------------------------- */}
        <section id="features" className="container scroll-mt-20 py-20 lg:py-28">
          <RevealOnScroll>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-300">
                Everything included
              </p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                A complete finance workspace, not a spreadsheet with a theme
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Every feature works out of the box against your own PostgreSQL
                database — nothing is stubbed, nothing phones home.
              </p>
            </div>
          </RevealOnScroll>

          <StaggerChildren className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="glass glow-border group p-6 transition-all duration-500 ease-smooth hover:-translate-y-1.5 hover:shadow-lift"
              >
                <div
                  className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-[0_10px_30px_-12px_rgba(124,58,237,0.9)] transition-transform duration-500 group-hover:scale-105`}
                >
                  <feature.icon className="size-5 text-white" strokeWidth={1.9} />
                </div>

                <h3 className="mt-5 text-base font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {feature.description}
                </p>
              </article>
            ))}
          </StaggerChildren>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* How it works                                                   */}
        {/* -------------------------------------------------------------- */}
        <section id="how-it-works" className="container scroll-mt-20 py-20 lg:py-28">
          <div className="glass glow-border overflow-hidden">
            <div className="grid gap-10 p-8 lg:grid-cols-2 lg:gap-16 lg:p-14">
              <RevealOnScroll>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">
                    How it works
                  </p>
                  <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white">
                    Three steps to a dashboard that tells the truth
                  </h2>

                  <ol className="mt-8 space-y-6">
                    {[
                      {
                        title: "Add what you spend",
                        body: "Type it naturally, use the quick-add form, or import a CSV, Excel, or JSON file from your bank.",
                      },
                      {
                        title: "Set budgets and goals",
                        body: "Cap the categories that get away from you and give your savings a target with a date attached.",
                      },
                      {
                        title: "Read the insights",
                        body: "Every month you get a plain-English read on what changed, what is at risk, and where the money actually went.",
                      },
                    ].map((step, index) => (
                      <li key={step.title} className="flex gap-4">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm font-semibold text-primary-300">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            {step.title}
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {step.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </RevealOnScroll>

              <RevealOnScroll delay={0.12}>
                <div className="glass-muted space-y-4 p-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                    Natural language input
                  </p>

                  {[
                    { input: "I spent $25 on pizza yesterday", chip: "Food · $25.00" },
                    { input: "Paid 1200 rent on the 1st", chip: "Bills · $1,200.00" },
                    { input: "Received 4500 salary today", chip: "Salary · +$4,500.00" },
                  ].map((example) => (
                    <div key={example.input} className="space-y-2">
                      <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
                        {example.input}
                      </div>
                      <div className="flex items-center gap-2 pl-3.5">
                        <ArrowRight className="size-3 text-subtle" />
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-200">
                          {example.chip}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* CTA                                                            */}
        {/* -------------------------------------------------------------- */}
        <section className="container pb-24 lg:pb-32">
          <RevealOnScroll>
            <div className="glass glow-border relative overflow-hidden px-8 py-14 text-center lg:px-16 lg:py-20">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-brand-gradient-soft"
              />
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Stop guessing where the money went
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
                Set it up in a couple of minutes. Seed it with sample data if you
                want to look around first.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Create your account
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login">I already have one</Link>
                </Button>
              </div>
            </div>
          </RevealOnScroll>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-subtle">
            Built with Next.js, Prisma, and PostgreSQL.
          </p>
          <div className="flex items-center gap-4 text-xs text-subtle">
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
            <Link href="/signup" className="transition-colors hover:text-white">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

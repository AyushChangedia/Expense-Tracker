import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { PageTransition } from "@/components/shared/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { UserProfile } from "@/types";

export const metadata: Metadata = {
  title: "Settings",
  description: "Profile, currency, security, and your data.",
};

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <PageTransition className="space-y-5">
      <PageHeader
        title="Settings"
        description="Your profile, how numbers are formatted, and everything to do with your data."
      />

      <Suspense fallback={<SettingsLoading />}>
        <SettingsContent />
      </Suspense>
    </PageTransition>
  );
}

async function SettingsContent() {
  const user = await requireUser();

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      currency: true,
      dateFormat: true,
      locale: true,
      weekStart: true,
      createdAt: true,
      // Only whether a password exists — never the hash itself.
      passwordHash: true,
    },
  });

  const profile: UserProfile = {
    id: record.id,
    name: record.name,
    email: record.email,
    image: record.image,
    currency: record.currency,
    dateFormat: record.dateFormat,
    locale: record.locale,
    weekStart: record.weekStart,
    hasPassword: Boolean(record.passwordHash),
    createdAt: record.createdAt.toISOString(),
  };

  return <SettingsView profile={profile} />;
}

function SettingsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80 max-w-full rounded-xl" />
      <div className="glass space-y-4 p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

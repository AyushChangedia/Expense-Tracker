import { GradientBlobs } from "@/components/shared/gradient-blobs";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import {
  CommandPalette,
  GlobalShortcuts,
} from "@/components/layout/command-palette";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { TransactionDialogProvider } from "@/components/providers/transaction-dialog-provider";
import { requireUser } from "@/lib/session";
import { getCategories, getTags } from "@/server/queries/categories";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/server/queries/activity";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Loaded once for the whole shell rather than per page: categories and tags
  // are needed by every form, and the notification bell lives in the topbar.
  const [categories, tags, notifications, unreadCount] = await Promise.all([
    getCategories(user.id),
    getTags(user.id),
    getNotifications(user.id, 20),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <PreferencesProvider
      preferences={{
        currency: user.currency,
        dateFormat: user.dateFormat,
        locale: user.locale,
        weekStart: user.weekStart,
      }}
      categories={categories}
      tags={tags}
    >
      <TransactionDialogProvider>
        <GradientBlobs variant="subtle" />

        <div className="flex min-h-dvh">
          <Sidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              user={user}
              notifications={notifications}
              unreadCount={unreadCount}
            />

            <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:pt-8">
              <div className="mx-auto w-full max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>

        <MobileNav />
        <CommandPalette />
        <GlobalShortcuts />
      </TransactionDialogProvider>
    </PreferencesProvider>
  );
}

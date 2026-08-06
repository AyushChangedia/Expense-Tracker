"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Menu,
  Minus,
  Plus,
  Search,
  Settings,
  Shapes,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/shared/logo";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { useIsMac, useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { NAV_SECTIONS, isActivePath } from "@/lib/navigation";
import { initials, cn } from "@/lib/utils";
import { signOutUser } from "@/server/actions/auth";
import type { NotificationDTO } from "@/types";
import type { SessionUser } from "@/lib/session";

export function Topbar({
  user,
  notifications,
  unreadCount,
}: {
  user: SessionUser;
  notifications: NotificationDTO[];
  unreadCount: number;
}) {
  const pathname = usePathname();
  const isMac = useIsMac();
  const { openCreate } = useTransactionDialog();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close the drawer whenever the route changes.
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  React.useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useKeyboardShortcut("Escape", () => setMobileNavOpen(false), {
    enabled: mobileNavOpen,
    preventDefault: false,
  });

  function openPalette() {
    // Re-dispatch as the shortcut the palette listens for, so there is one
    // owner of that state rather than two.
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }

  return (
    <>
      {/*
        `pt-safe` pushes the controls clear of the status bar / notch. Without
        it an installed PWA renders this row underneath system UI, which makes
        the menu, search, and avatar impossible to tap.
      */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-canvas/70 pt-safe backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-gutter">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-colors hover:text-white lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>

          <Link href="/dashboard" className="shrink-0 lg:hidden">
            <Logo showWordmark={false} />
          </Link>

          {/* Search trigger — opens the ⌘K palette. */}
          <button
            type="button"
            onClick={openPalette}
            className="group hidden h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-subtle transition-all duration-300 hover:border-white/[0.16] hover:bg-white/[0.05] sm:flex sm:max-w-md"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">
              Search transactions, categories, goals…
            </span>
            <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-white/[0.10] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-subtle md:flex">
              {isMac ? "⌘" : "Ctrl"}K
            </kbd>
          </button>

          <button
            type="button"
            onClick={openPalette}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-colors hover:text-white sm:hidden"
            aria-label="Search"
          >
            <Search className="size-4" />
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => openCreate({ type: "EXPENSE" })}
              className="hidden sm:inline-flex"
            >
              <Plus className="size-4" />
              Add
            </Button>

            <NotificationsMenu
              initialNotifications={notifications}
              initialUnread={unreadCount}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  aria-label="Account menu"
                >
                  <Avatar>
                    {user.image ? (
                      <AvatarImage src={user.image} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
                <div className="px-2.5 pb-2">
                  <p className="truncate text-sm font-medium text-white">
                    {user.name ?? "Your account"}
                  </p>
                  <p className="truncate text-xs text-subtle">{user.email}</p>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/categories">
                    <Shapes />
                    Categories &amp; tags
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  destructive
                  onSelect={(event) => {
                    event.preventDefault();
                    void signOutUser();
                  }}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {mobileNavOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-canvas/80 backdrop-blur-sm lg:hidden"
              aria-hidden
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,85vw)] flex-col border-r border-white/[0.08] bg-surface/95 pt-safe backdrop-blur-2xl lg:hidden"
              role="dialog"
              aria-label="Navigation"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
                {NAV_SECTIONS.map((section) => (
                  <div key={section.label} className="space-y-1">
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
                      {section.label}
                    </p>
                    {section.items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                            active
                              ? "border border-primary/25 bg-primary/12 text-white"
                              : "text-muted-foreground hover:bg-white/[0.05] hover:text-white",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "size-[18px]",
                              active ? "text-primary-300" : "text-subtle",
                            )}
                            strokeWidth={1.9}
                          />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/[0.06] p-4 pb-safe">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setMobileNavOpen(false);
                    openCreate({ type: "EXPENSE" });
                  }}
                >
                  <Minus className="size-4 text-danger" />
                  Expense
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setMobileNavOpen(false);
                    openCreate({ type: "INCOME" });
                  }}
                >
                  <Plus className="size-4 text-success" />
                  Income
                </Button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

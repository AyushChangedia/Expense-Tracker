"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, CheckCheck, Info, Trash2, TriangleAlert, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  clearNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/actions/notifications";
import type { NotificationDTO } from "@/types";

const TONE = {
  INFO: { icon: Info, className: "text-primary-300 bg-primary/10 border-primary/20" },
  SUCCESS: { icon: Check, className: "text-success bg-success/10 border-success/20" },
  WARNING: {
    icon: TriangleAlert,
    className: "text-warning bg-warning/10 border-warning/20",
  },
  DANGER: { icon: XCircle, className: "text-danger bg-danger/10 border-danger/20" },
} as const;

export function NotificationsMenu({
  initialNotifications,
  initialUnread,
}: {
  initialNotifications: NotificationDTO[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const [pending, startTransition] = React.useTransition();

  // Server-rendered props win whenever the page revalidates.
  React.useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const unread = notifications.filter((item) => !item.read).length;
  const badgeCount = open ? unread : (unread || initialUnread);

  function handleRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function handleReadAll() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  function handleClear() {
    setNotifications([]);
    startTransition(async () => {
      await clearNotifications();
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition-all duration-300 hover:border-white/[0.16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={
            badgeCount > 0 ? `Notifications, ${badgeCount} unread` : "Notifications"
          }
        >
          <Bell className="size-4" />
          <AnimatePresence>
            {badgeCount > 0 ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="tabular absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-brand-gradient px-1 text-[10px] font-semibold text-white shadow-[0_0_12px_-2px_rgba(139,92,246,0.9)]"
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Notifications</p>
            <p className="text-[11px] text-subtle">
              {unread > 0 ? `${unread} unread` : "You are all caught up"}
            </p>
          </div>

          {notifications.length > 0 ? (
            <div className="flex items-center gap-1">
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={handleReadAll}
                  disabled={pending}
                  className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                  aria-label="Mark all as read"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleClear}
                disabled={pending}
                className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                aria-label="Clear all notifications"
                title="Clear all"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <div className="grid size-11 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <Bell className="size-5 text-subtle" strokeWidth={1.6} />
              </div>
              <p className="text-sm text-white">Nothing here yet</p>
              <p className="text-xs text-muted-foreground">
                Budget alerts, recurring posts, and goal milestones show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              <AnimatePresence initial={false}>
                {notifications.map((notification) => {
                  const tone = TONE[notification.type] ?? TONE.INFO;
                  const Icon = tone.icon;

                  const body = (
                    <div className="flex gap-3">
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border",
                          tone.className,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm",
                            notification.read ? "text-muted-foreground" : "text-white",
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[10px] text-subtle">
                          {relativeTime(notification.createdAt)}
                        </p>
                      </div>

                      {!notification.read ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(139,92,246,0.9)]" />
                      ) : null}
                    </div>
                  );

                  return (
                    <motion.li
                      key={notification.id}
                      layout
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "px-4 py-3 transition-colors hover:bg-white/[0.03]",
                        !notification.read && "bg-primary/[0.04]",
                      )}
                    >
                      {notification.href ? (
                        <Link
                          href={notification.href}
                          onClick={() => {
                            if (!notification.read) handleRead(notification.id);
                            setOpen(false);
                          }}
                          className="block"
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => !notification.read && handleRead(notification.id)}
                          className="block w-full text-left"
                        >
                          {body}
                        </button>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {notifications.length > 0 ? (
          <div className="border-t border-white/[0.06] p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

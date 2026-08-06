"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { MOBILE_NAV_ITEMS, isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar for small screens, with a floating add button.
 * Hidden from `lg` up, where the sidebar takes over.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { openCreate } = useTransactionDialog();

  return (
    <>
      {/* Floating quick-add, clear of the tab bar. */}
      <motion.button
        type="button"
        onClick={() => openCreate({ type: "EXPENSE" })}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        whileTap={{ scale: 0.92 }}
        className="bottom-safe-20 fixed right-4 z-30 grid size-14 place-items-center rounded-2xl bg-brand-gradient shadow-[0_12px_36px_-8px_rgba(124,58,237,0.9)] lg:hidden"
        aria-label="Add transaction"
      >
        <Plus className="size-6 text-white" strokeWidth={2.4} />
      </motion.button>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-canvas/85 pb-safe backdrop-blur-2xl lg:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors duration-300",
                    active ? "text-white" : "text-subtle",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="mobile-nav-indicator"
                      className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand-gradient"
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : null}

                  <item.icon
                    className={cn(
                      "size-[18px] transition-colors",
                      active ? "text-primary-300" : "text-subtle",
                    )}
                    strokeWidth={1.9}
                  />
                  <span className="truncate px-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

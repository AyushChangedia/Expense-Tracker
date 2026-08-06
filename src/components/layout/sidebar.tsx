"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Logo, LogoMark } from "@/components/shared/logo";
import { NAV_SECTIONS, isActivePath } from "@/lib/navigation";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Desktop sidebar. Collapsing narrows it to icons only; the choice is kept in
 * localStorage so it survives navigation and reloads.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setCollapsed(window.localStorage.getItem("fluxfin:sidebar") === "collapsed");
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("fluxfin:sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-white/[0.06] bg-surface/40 backdrop-blur-xl transition-[width] duration-500 ease-smooth lg:flex",
        collapsed ? "w-[74px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/[0.06]",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        <Link href="/dashboard" className="rounded-lg">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>

        {!collapsed ? (
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="hide-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-1">
            {!collapsed ? (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
                {section.label}
              </p>
            ) : null}

            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-300",
                    collapsed && "justify-center px-0",
                    active
                      ? "text-white"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  {/* The active pill slides between items rather than popping. */}
                  {active && mounted ? (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 -z-10 rounded-xl border border-primary/25 bg-primary/12"
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : null}
                  {active && !mounted ? (
                    <span className="absolute inset-0 -z-10 rounded-xl border border-primary/25 bg-primary/12" />
                  ) : null}

                  <item.icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      active ? "text-primary-300" : "text-subtle group-hover:text-white",
                    )}
                    strokeWidth={1.9}
                  />

                  {!collapsed ? (
                    <span className="truncate font-medium">{item.label}</span>
                  ) : null}
                </Link>
              );

              return collapsed ? (
                <Hint key={item.href} label={item.label} side="right">
                  {link}
                </Hint>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      {collapsed ? (
        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={toggle}
            className="grid w-full place-items-center rounded-lg py-2 text-subtle transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      ) : (
        <div className="border-t border-white/[0.06] p-4">
          <div className="glass-muted p-3">
            <p className="text-xs font-medium text-white">Quick tip</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Press{" "}
              <kbd className="rounded border border-white/[0.10] bg-white/[0.05] px-1 font-mono text-[10px]">
                ⌘K
              </kbd>{" "}
              to search, jump, or add anything.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

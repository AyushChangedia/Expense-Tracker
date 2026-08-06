"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Download,
  History,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/page-header";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ActivityDTO } from "@/types";

const ACTION_STYLE: Record<
  string,
  { icon: LucideIcon; className: string }
> = {
  created: { icon: Plus, className: "text-success bg-success/10 border-success/20" },
  updated: { icon: PenLine, className: "text-primary-300 bg-primary/10 border-primary/20" },
  deleted: { icon: Trash2, className: "text-danger bg-danger/10 border-danger/20" },
  restored: { icon: RotateCcw, className: "text-cyan bg-cyan/10 border-cyan/20" },
  imported: { icon: Download, className: "text-primary-300 bg-primary/10 border-primary/20" },
  generated: { icon: RefreshCw, className: "text-cyan bg-cyan/10 border-cyan/20" },
};

const FALLBACK = {
  icon: ArrowLeftRight,
  className: "text-muted-foreground bg-white/[0.05] border-white/[0.08]",
};

export function ActivityTimeline({ activities }: { activities: ActivityDTO[] }) {
  return (
    <div className="glass glow-border flex h-full flex-col overflow-hidden">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <SectionHeading
          title="Recent activity"
          description="Everything that changed, newest first"
        />
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing logged yet"
          description="Adding, editing, and importing all show up here as a running history."
          compact
        />
      ) : (
        <ol className="relative flex-1 space-y-0 px-5 pb-6 sm:px-6">
          {/* The connecting rail behind the markers. */}
          <span
            aria-hidden
            className="absolute bottom-8 left-[27px] top-2 w-px bg-gradient-to-b from-white/[0.10] via-white/[0.06] to-transparent sm:left-[31px]"
          />

          {activities.map((activity, index) => {
            const style = ACTION_STYLE[activity.action] ?? FALLBACK;
            const Icon = style.icon;

            return (
              <motion.li
                key={activity.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(index * 0.05, 0.35),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <span
                  className={cn(
                    "relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border",
                    style.className,
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm leading-snug text-white text-pretty">
                    {activity.summary}
                  </p>
                  <p className="mt-0.5 text-[11px] text-subtle">
                    {relativeTime(activity.createdAt)}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

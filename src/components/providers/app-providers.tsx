"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";

import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side context that wraps the whole app: auth session, tooltips, and
 * the toast host.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        {children}
        <Toaster
          position="bottom-right"
          expand={false}
          duration={4500}
          gap={10}
          offset={20}
          // Styling the toasts directly keeps them on the glass design language
          // instead of Sonner's light defaults.
          toastOptions={{
            unstyled: false,
            classNames: {
              toast:
                "group !rounded-xl !border !border-white/[0.08] !bg-surface/95 !text-white !backdrop-blur-2xl !shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)]",
              title: "!text-sm !font-medium !text-white",
              description: "!text-xs !text-muted-foreground",
              actionButton:
                "!rounded-lg !bg-brand-gradient !text-white !text-xs !font-medium !px-2.5 !h-7",
              cancelButton:
                "!rounded-lg !bg-white/[0.06] !text-muted-foreground !text-xs !px-2.5 !h-7",
              closeButton:
                "!bg-surface !border-white/[0.08] !text-muted-foreground hover:!text-white",
              success: "!border-success/25",
              error: "!border-danger/25",
              warning: "!border-warning/25",
              info: "!border-primary/25",
            },
          }}
          icons={{
            success: <CheckCircle2 className="size-4 text-success" />,
            error: <XCircle className="size-4 text-danger" />,
            warning: <TriangleAlert className="size-4 text-warning" />,
            info: <Info className="size-4 text-primary-300" />,
          }}
        />
      </TooltipProvider>
    </SessionProvider>
  );
}

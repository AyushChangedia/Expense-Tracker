"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/shared/logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The `beforeinstallprompt` event, which is still not in the DOM lib types.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "fluxfin:install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag, set when launched from the home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

/**
 * Shared install state.
 *
 * Chromium fires `beforeinstallprompt` once, early — if nothing captures it,
 * the chance to show a native install dialog is gone. This hook stashes the
 * event so any part of the UI can trigger it later.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [iosHelpOpen, setIosHelpOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());

    const onBeforeInstall = (event: Event) => {
      // Suppress Chrome's mini-infobar so the in-app button is the only entry
      // point, and keep the event for when the user actually asks.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = React.useCallback(async () => {
    // iOS has no programmatic install; the only route is Share → Add to Home
    // Screen, so show the steps instead of a dead button.
    if (!deferred) {
      if (isIos()) setIosHelpOpen(true);
      return;
    }

    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }, [deferred]);

  const canInstall = mounted && !installed && (Boolean(deferred) || isIos());

  return { canInstall, installed, install, iosHelpOpen, setIosHelpOpen, mounted };
}

/** Explains the manual install path on iOS, where there is no prompt API. */
export function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add FluxFin to your Home Screen</DialogTitle>
          <DialogDescription>
            Safari installs apps manually. Two taps and it behaves exactly like
            a native app.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 px-6 pb-6">
          {[
            {
              icon: Share,
              text: "Tap the Share button in Safari's toolbar",
            },
            {
              icon: SquarePlus,
              text: 'Scroll down and choose "Add to Home Screen"',
            },
            {
              icon: Download,
              text: 'Tap "Add" — FluxFin appears on your Home Screen',
            },
          ].map((step, index) => (
            <li key={index} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-primary-300">
                {index + 1}
              </span>
              <step.icon className="size-4 shrink-0 text-primary-300" />
              <span className="text-sm text-muted-foreground">{step.text}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/** A plain button, for the settings page. */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, installed, install, iosHelpOpen, setIosHelpOpen, mounted } =
    useInstallPrompt();

  if (!mounted) return null;

  return (
    <>
      <Button
        variant={installed ? "secondary" : "default"}
        onClick={() => void install()}
        disabled={installed || !canInstall}
        className={className}
      >
        <Download className="size-4" />
        {installed
          ? "Installed"
          : canInstall
            ? "Install app"
            : "Install unavailable"}
      </Button>

      <IosInstallDialog open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </>
  );
}

/**
 * A dismissible banner shown once the user has had a moment to look around.
 * Stays out of the way: hidden after a dismissal, and never shown to someone
 * already running the installed app.
 */
export function InstallBanner() {
  const { canInstall, install, iosHelpOpen, setIosHelpOpen } = useInstallPrompt();
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  const visible = canInstall && !dismissed;

  return (
    <>
      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            // Sits above the mobile tab bar, out of the way of the FAB.
            className="fixed inset-x-4 bottom-[152px] z-30 mx-auto max-w-sm lg:inset-x-auto lg:bottom-6 lg:right-6 lg:max-w-xs"
          >
            <div className="glass glow-border flex items-start gap-3 p-4" data-active="true">
              <LogoMark className="mt-0.5 size-9 shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Install FluxFin</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Add it to your home screen for a full-screen app with its own
                  icon.
                </p>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => void install()}>
                    <Download className="size-3.5" />
                    Install
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismiss}>
                    Not now
                  </Button>
                </div>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 rounded-lg p-1 text-subtle transition-colors hover:bg-white/[0.08] hover:text-white"
                aria-label="Dismiss install prompt"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <IosInstallDialog open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </>
  );
}
